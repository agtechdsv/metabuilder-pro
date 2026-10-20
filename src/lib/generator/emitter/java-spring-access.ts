import type { AppAST, ModelNode, RouteNode } from '../ast'
import { tableAccessConfigs } from '../layers/access'
import { isTableClosed } from '../../rowPolicy/policy'
import {
  getIncomingFks, getPkFields, getPkJavaType, hasCompositePk, getEffectivePkField,
  javaParseExpr, toCamelCase, toJavaType, javaCascadeDelete,
} from './java-spring-backend'

/**
 * Acesso do usuário final no backend Java: regras por linha, "bloquear por padrão" e auditoria (quem/quando), os mesmos recursos
 * do app Node. A API só recebe chamadas do servidor do frontend, que assina um JWT com os dados do usuário logado (e-mail, nome e
 * colunas do cadastro). O backend lê esse JWT, resolve as regras da tabela para aquele usuário e as aplica em toda consulta e gravação.
 *
 * Falha fechada: sem usuário, ou sem o dado que a regra pede, a tabela fica negada (leitura vazia, gravação recusada com 403).
 * Chamadas internas do próprio app (login, gestão de acesso) vêm marcadas como "sistema" e não passam pelas regras.
 */

const lastSeg = (t: string) => t.split('.').pop()!.toLowerCase()
const J = (s: string) => JSON.stringify(s)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** O projeto tem regra por linha, tabela fechada ou auditoria que o backend precisa aplicar? */
export function javaNeedsAccess(ast: AppAST): boolean {
  return ast.models.some(m => (m.rowPolicy && m.rowPolicy.rules.length > 0) || !!m.audit || isTableClosed(ast.authConfig?.tableAccess, m.dbTable))
}

/** Tabelas só do próprio app (gestão de acesso): o usuário final nunca as lê nem grava, só as chamadas internas. */
function systemTables(ast: AppAST): Set<string> {
  const a = ast.accessAdmin
  if (!a) return new Set()
  return new Set([a.perms.table, ...(a.groups.synthetic ? [a.groups.table] : []), ...(a.link.kind === 'table' && a.link.synthetic ? [a.link.table] : [])].map(lastSeg))
}

/** Colunas de auditoria da tabela (nomes das colunas no banco). */
export function auditColumnNames(model: ModelNode): string[] {
  return Object.values(model.audit?.columns || {}).filter((c): c is string => !!c)
}

// ─────────────────────────────────────────────────────────────────────────────
// Arquivos do pacote access + configuração
// ─────────────────────────────────────────────────────────────────────────────

export function generateJavaAccess(ast: AppAST, files: Map<string, string>, basePkg: string, groupId: string): void {
  const pkg = `${basePkg}/access`
  const sys = systemTables(ast)

  files.set('backend/src/main/resources/mb-access.json', JSON.stringify({
    tables: tableAccessConfigs(ast).map(c => ({ ...c, table: lastSeg(c.table), closed: !!c.closed, systemOnly: sys.has(lastSeg(c.table)), policy: c.policy ?? null, audit: c.audit ?? null })),
  }, null, 2) + '\n')

  files.set(`${pkg}/CurrentUser.java`, currentUserJava(groupId, !!ast.jwtEnabled))
  files.set(`${pkg}/AccessRules.java`, accessRulesJava(groupId))
  files.set(`${pkg}/AccessMeta.java`, accessMetaJava(ast, groupId))
  files.set(`${pkg}/PolicySpecs.java`, policySpecsJava(groupId))
  files.set(`${pkg}/AccessEnforcer.java`, accessEnforcerJava(groupId))
  files.set(`${pkg}/AccessExceptionHandler.java`, `package ${groupId}.access;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** Acesso negado pelas regras da tabela: 403 com a mensagem (o frontend a mostra ao usuário). */
@RestControllerAdvice
public class AccessExceptionHandler {

    @ExceptionHandler(AccessEnforcer.AccessDenied.class)
    public ResponseEntity<Map<String, String>> denied(AccessEnforcer.AccessDenied e) {
        return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
    }
}
`)
}

/** JwtFilter que também leva os dados do usuário (CurrentUser) como principal da requisição. */
export function jwtFilterWithUser(groupId: string): string {
  return `package ${groupId}.security;

import ${groupId}.access.CurrentUser;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    public JwtFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtUtil.validateToken(token)) {
                // o principal leva o usuário final (e-mail, nome, colunas do cadastro) para as regras de acesso das tabelas
                Claims claims = jwtUtil.extractClaims(token);
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                CurrentUser.from(claims),
                                null,
                                Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"))
                        );
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }

        filterChain.doFilter(request, response);
    }
}
`
}

function currentUserJava(groupId: string, jwt: boolean): string {
  return `package ${groupId}.access;

${jwt ? 'import io.jsonwebtoken.Claims;\n' : ''}import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Quem está chamando a API: lido do JWT que o frontend assina com a sessão do usuário final. */
public record CurrentUser(String email, String name, Map<String, String> attrs, List<String> groups, boolean system) {
${jwt ? `
    public static CurrentUser from(Claims claims) {
        Map<String, String> attrs = new HashMap<>();
        Object raw = claims.get("attrs");
        if (raw instanceof Map<?, ?> m) {
            m.forEach((k, v) -> {
                if (k != null && v != null) attrs.put(String.valueOf(k), String.valueOf(v));
            });
        }
        List<String> groups = new ArrayList<>();
        Object rawGroups = claims.get("groups");
        if (rawGroups instanceof List<?> l) {
            for (Object g : l) {
                if (g != null && !String.valueOf(g).isBlank()) groups.add(String.valueOf(g).trim());
            }
        }
        return new CurrentUser(claims.get("email", String.class), claims.get("name", String.class), attrs, groups,
                Boolean.TRUE.equals(claims.get("sys", Boolean.class)));
    }
` : ''}
    /** O usuário da requisição atual (null se não há). */
    public static CurrentUser current() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getPrincipal() instanceof CurrentUser u ? u : null;
    }

    /** Valor do usuário para uma fonte de regra (user.email, user.name ou user.attr); null se faltar ou estiver vazio. */
    public String value(String source, String attr) {
        String raw = null;
        if ("user.email".equals(source)) {
            raw = email;
        } else if ("user.name".equals(source)) {
            raw = name;
        } else if (attr != null && attrs != null) {
            for (Map.Entry<String, String> e : attrs.entrySet()) {
                if (e.getKey().equalsIgnoreCase(attr)) {
                    raw = e.getValue();
                    break;
                }
            }
        }
        if (raw == null) return null;
        String s = raw.trim();
        return s.isEmpty() ? null : s;
    }
}
`
}

function accessRulesJava(groupId: string): string {
  return `package ${groupId}.access;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Regras de acesso de cada tabela (mb-access.json, gerado do projeto) resolvidas para o usuário da requisição.
 * Falha fechada: sem usuário, ou sem o dado que a regra exige, a tabela fica negada.
 */
@Component
public class AccessRules {

    public record Related(String table, String key, String column) {}
    public record Bypass(String source, String attr, List<String> values) {}
    public record Rule(String id, String column, String op, String source, String attr, Related related, Bypass bypass) {}
    public record Policy(List<Rule> rules) {}
    public record AuditCols(String createdAt, String createdBy, String updatedAt, String updatedBy) {}
    public record By(String source, String attr) {}
    public record Audit(AuditCols columns, By by) {}
    public record TableCfg(String table, boolean canCreate, boolean canUpdate, boolean canDelete, Policy policy, Audit audit, boolean closed, boolean systemOnly) {}
    public record Config(List<TableCfg> tables) {}

    /** Condição já resolvida para o usuário (valores dele). */
    public record Cond(String column, String op, List<String> values, Related related) {}

    /** O que vale para uma tabela e um usuário. cfg é null se a tabela não tem nada configurado. */
    public record Resolved(TableCfg cfg, boolean denied, List<Cond> conds, String actor) {
        public boolean canCreate() { return cfg == null || cfg.canCreate(); }
        public boolean canUpdate() { return cfg == null || cfg.canUpdate(); }
        public boolean canDelete() { return cfg == null || cfg.canDelete(); }
    }

    private final Map<String, TableCfg> byTable = new HashMap<>();

    public AccessRules() {
        try (InputStream in = AccessRules.class.getResourceAsStream("/mb-access.json")) {
            ObjectMapper om = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            Config cfg = om.readValue(in, Config.class);
            for (TableCfg t : cfg.tables()) byTable.put(key(t.table()), t);
        } catch (Exception e) {
            // sem a configuração não dá para garantir o acesso: não sobe
            throw new IllegalStateException("Não foi possível ler mb-access.json", e);
        }
    }

    static String key(String table) {
        String t = table == null ? "" : table;
        int i = t.lastIndexOf('.');
        return (i >= 0 ? t.substring(i + 1) : t).toLowerCase();
    }

    public Resolved resolve(String table, CurrentUser user) {
        TableCfg c = byTable.get(key(table));
        if (c == null) return new Resolved(null, false, List.of(), null);
        boolean system = user != null && user.system();
        // tabelas do próprio app (gestão de acesso): só as chamadas internas
        if (c.systemOnly() && !system) return new Resolved(c, true, List.of(), null);
        // chamadas internas (login, gestão de acesso) não passam pelas regras do usuário final
        if (system) return new Resolved(c, false, List.of(), null);

        String actor = null;
        if (user != null && c.audit() != null && c.audit().by() != null) {
            actor = user.value(c.audit().by().source(), c.audit().by().attr());
        }
        // "bloquear por padrão": tabela não liberada fica negada por inteiro
        if (c.closed()) return new Resolved(c, true, List.of(), actor);
        if (c.policy() == null || c.policy().rules() == null || c.policy().rules().isEmpty()) {
            return new Resolved(c, false, List.of(), actor);
        }

        List<Cond> conds = new ArrayList<>();
        for (Rule rule : c.policy().rules()) {
            if (bypassed(rule, user)) continue;
            String value = user == null ? null : user.value(rule.source(), rule.attr());
            if (value == null) return new Resolved(c, true, List.of(), actor);
            List<String> values = List.of(value);
            if ("in".equals(rule.op())) {
                values = Arrays.stream(value.split(",")).map(String::trim).filter(s -> !s.isEmpty()).limit(100).toList();
                if (values.isEmpty()) return new Resolved(c, true, List.of(), actor);
            }
            conds.add(new Cond(rule.column(), rule.op(), values, "related".equals(rule.op()) ? rule.related() : null));
        }
        return new Resolved(c, false, conds, actor);
    }

    private boolean bypassed(Rule rule, CurrentUser user) {
        if (rule.bypass() == null || user == null || rule.bypass().values() == null) return false;
        // exceção por grupo: basta UM dos grupos do usuário estar na lista
        if ("user.group".equals(rule.bypass().source())) {
            return user.groups() != null && user.groups().stream().anyMatch(g -> rule.bypass().values().stream().anyMatch(x -> x.equalsIgnoreCase(g)));
        }
        String v = user.value(rule.bypass().source(), rule.bypass().attr());
        return v != null && rule.bypass().values().stream().anyMatch(x -> x.equalsIgnoreCase(v));
    }
}
`
}

function accessMetaJava(ast: AppAST, groupId: string): string {
  const entity: string[] = []
  const property: string[] = []
  const convert: string[] = []
  const type: string[] = []
  const seenT = new Set<string>()
  const seenC = new Set<string>()
  for (const m of ast.models) {
    const t = lastSeg(m.dbTable)
    if (!seenT.has(t)) { seenT.add(t); entity.push(`            case ${J(t)}: return ${m.name}.class;`) }
    const composite = hasCompositePk(m)
    const pk = new Set(getPkFields(m).map(f => f.dbColumn))
    for (const f of m.fields.filter(x => !x.dbColumn.includes('.'))) {
      const k = `${t}.${f.dbColumn.toLowerCase()}`
      if (seenC.has(k)) continue
      seenC.add(k)
      const jt = toJavaType(f.dataType)
      property.push(`            case ${J(k)}: return ${J(composite && pk.has(f.dbColumn) ? `id.${toCamelCase(f.dbColumn)}` : toCamelCase(f.dbColumn))};`)
      if (jt !== 'byte[]') {
        convert.push(`            case ${J(k)}: return ${javaParseExpr(jt, 'v')};`)
        type.push(`            case ${J(k)}: return ${JAVA_CLASS[jt] ?? 'String.class'};`)
      }
    }
  }
  return `package ${groupId}.access;

import ${groupId}.entities.*;

/** Mapa entre tabelas/colunas do banco e as entidades Java (gerado do projeto). */
public final class AccessMeta {
    private AccessMeta() {}

    public static Class<?> entity(String table) {
        switch (table.toLowerCase()) {
${entity.join('\n')}
            default: throw new IllegalArgumentException("Tabela desconhecida nas regras de acesso: " + table);
        }
    }

    /** Nome do atributo da entidade (ex.: "clienteId", ou "id.pedidoId" para colunas da chave composta). */
    public static String property(String table, String column) {
        switch ((table + "." + column).toLowerCase()) {
${property.join('\n')}
            default: throw new IllegalArgumentException("Coluna desconhecida nas regras de acesso: " + table + "." + column);
        }
    }

    /** Tipo Java da coluna (a subconsulta das regras "relacionadas" precisa dele para comparar com a coluna da tabela). */
    public static Class<?> type(String table, String column) {
        switch ((table + "." + column).toLowerCase()) {
${type.join('\n')}
            default: throw new IllegalArgumentException("Coluna desconhecida nas regras de acesso: " + table + "." + column);
        }
    }

    /** Converte o texto do valor do usuário para o tipo Java da coluna. */
    public static Object convert(String table, String column, String v) {
        switch ((table + "." + column).toLowerCase()) {
${convert.join('\n')}
            default: throw new IllegalArgumentException("Coluna desconhecida nas regras de acesso: " + table + "." + column);
        }
    }
}
`
}

function policySpecsJava(groupId: string): string {
  return `package ${groupId}.access;

import jakarta.persistence.criteria.From;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

/** Transforma as regras resolvidas de uma tabela num filtro (Specification) aplicado a toda consulta. */
public final class PolicySpecs {
    private PolicySpecs() {}

    /** Caminho de um atributo (ex.: "id.pedidoId") a partir da raiz. */
    public static Path<Object> path(From<?, ?> from, String property) {
        String[] parts = property.split("\\\\.");
        Path<Object> p = from.get(parts[0]);
        for (int i = 1; i < parts.length; i++) p = p.get(parts[i]);
        return p;
    }

    public static <T> Specification<T> scope(String table, AccessRules.Resolved r) {
        return (root, query, cb) -> {
            if (r.denied()) return cb.disjunction();
            try {
                List<Predicate> ps = new ArrayList<>();
                for (AccessRules.Cond c : r.conds()) {
                    Path<Object> col = path(root, AccessMeta.property(table, c.column()));
                    if ("related".equals(c.op())) {
                        AccessRules.Related rel = c.related();
                        // a subconsulta leva o tipo da coluna-chave (o Hibernate confere os tipos ao comparar)
                        @SuppressWarnings("unchecked")
                        Class<Object> keyType = (Class<Object>) AccessMeta.type(rel.table(), rel.key());
                        Subquery<Object> sq = query.subquery(keyType);
                        Root<?> rr = sq.from(AccessMeta.entity(rel.table()));
                        sq.select(path(rr, AccessMeta.property(rel.table(), rel.key())))
                          .where(cb.equal(path(rr, AccessMeta.property(rel.table(), rel.column())),
                                  AccessMeta.convert(rel.table(), rel.column(), c.values().get(0))));
                        ps.add(col.in(sq));
                    } else if ("in".equals(c.op())) {
                        ps.add(col.in(c.values().stream().map(v -> AccessMeta.convert(table, c.column(), v)).toList()));
                    } else {
                        ps.add(cb.equal(col, AccessMeta.convert(table, c.column(), c.values().get(0))));
                    }
                }
                return cb.and(ps.toArray(new Predicate[0]));
            } catch (RuntimeException e) {
                // regra que não dá para montar (coluna desconhecida, valor do usuário no tipo errado): nega, nunca libera
                return cb.disjunction();
            }
        };
    }
}
`
}

function accessEnforcerJava(groupId: string): string {
  return `package ${groupId}.access;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Root;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/** Confere cada gravação (criar/editar) de acordo com as permissões e as regras por linha da tabela e carimba a auditoria. */
@Component
public class AccessEnforcer {

    /** Recusa de acesso (vira 403 com a mensagem). */
    public static class AccessDenied extends RuntimeException {
        public AccessDenied(String message) { super(message); }
    }

    /** Como ler/gravar as colunas de uma entidade (gerado por tabela). */
    public interface EntityAccess<T> {
        Object get(T entity, String column);
        void set(T entity, String column, String value);
        /** Preenche a auditoria com os valores do servidor (o que a tela mandar nessas colunas é descartado). */
        void stamp(T entity, boolean insert, String actor);
    }

    @PersistenceContext
    private EntityManager em;

    private final AccessRules rules;

    public AccessEnforcer(AccessRules rules) {
        this.rules = rules;
    }

    public AccessRules.Resolved resolve(String table) {
        return rules.resolve(table, CurrentUser.current());
    }

    public <T> void checkWrite(String table, boolean insert, T entity, EntityAccess<T> acc) {
        AccessRules.Resolved r = resolve(table);
        if (insert && !r.canCreate()) throw new AccessDenied("Esta tabela não permite criar registros.");
        if (!insert && !r.canUpdate()) throw new AccessDenied("Esta tabela não permite editar registros.");
        if (r.denied()) throw new AccessDenied("Você não tem acesso aos registros desta tabela.");

        // auditoria primeiro: a regra por linha confere o resultado final
        acc.stamp(entity, insert, r.actor());

        // os valores gravados precisam obedecer à regra (senão o usuário criaria, ou passaria para outro dono, uma linha que não enxerga)
        for (AccessRules.Cond c : r.conds()) {
            Object v = acc.get(entity, c.column());
            boolean empty = v == null || (v instanceof String s && s.isBlank());
            if (empty) {
                if (!insert) throw new AccessDenied("O campo \\"" + c.column() + "\\" é controlado pelo seu acesso e não pode ficar vazio.");
                // coluna ausente no cadastro: a regra "igual" (ou lista de um valor só) preenche
                if (!"related".equals(c.op()) && c.values().size() == 1) acc.set(entity, c.column(), c.values().get(0));
                continue;
            }
            if ("related".equals(c.op())) {
                if (!relatedExists(c, v)) throw new AccessDenied("O valor de \\"" + c.column() + "\\" está fora do seu acesso.");
            } else if (c.values().stream().noneMatch(s -> same(v, s, table, c.column()))) {
                throw new AccessDenied("O valor de \\"" + c.column() + "\\" está fora do seu acesso.");
            }
        }
    }

    private boolean same(Object v, String raw, String table, String column) {
        if (String.valueOf(v).equals(raw)) return true;
        try {
            Object conv = AccessMeta.convert(table, column, raw);
            if (v instanceof BigDecimal a && conv instanceof BigDecimal b) return a.compareTo(b) == 0;
            return v.equals(conv);
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** A linha da outra tabela que a regra "relacionada" exige existe (chave = valor gravado e coluna = valor do usuário)? */
    private boolean relatedExists(AccessRules.Cond c, Object value) {
        AccessRules.Related rel = c.related();
        try {
            CriteriaBuilder cb = em.getCriteriaBuilder();
            CriteriaQuery<Long> q = cb.createQuery(Long.class);
            Root<?> r = q.from(AccessMeta.entity(rel.table()));
            q.select(cb.count(r)).where(
                    cb.equal(PolicySpecs.path(r, AccessMeta.property(rel.table(), rel.key())),
                            AccessMeta.convert(rel.table(), rel.key(), String.valueOf(value))),
                    cb.equal(PolicySpecs.path(r, AccessMeta.property(rel.table(), rel.column())),
                            AccessMeta.convert(rel.table(), rel.column(), c.values().get(0))));
            return em.createQuery(q).getSingleResult() > 0;
        } catch (RuntimeException e) {
            return false;
        }
    }
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Service com as regras (substitui o Service comum quando o projeto tem acesso por linha, tabela fechada ou auditoria)
// ─────────────────────────────────────────────────────────────────────────────

const JAVA_CLASS: Record<string, string> = {
  String: 'String.class', Integer: 'Integer.class', Long: 'Long.class', BigDecimal: 'java.math.BigDecimal.class', Double: 'Double.class',
  Float: 'Float.class', Boolean: 'Boolean.class', UUID: 'java.util.UUID.class', LocalDate: 'java.time.LocalDate.class',
  LocalDateTime: 'java.time.LocalDateTime.class', OffsetDateTime: 'java.time.OffsetDateTime.class',
}

const NOW: Record<string, string> = {
  LocalDateTime: 'java.time.LocalDateTime.now()',
  OffsetDateTime: 'java.time.OffsetDateTime.now()',
  LocalDate: 'java.time.LocalDate.now()',
  String: 'java.time.OffsetDateTime.now().toString()',
}

export function generateGuardedServiceClass(model: ModelNode, ast: AppAST, groupId: string, route?: RouteNode): string {
  const pkType = getPkJavaType(model)
  const isComposite = hasCompositePk(model)
  const incomingFks = getIncomingFks(model, ast)
  const cascade = javaCascadeDelete(model, ast)
  const hasGrid = !!(route && route.gridFields && route.gridFields.length > 0)
  const table = lastSeg(model.dbTable)
  const fields = model.fields.filter(f => !f.dbColumn.includes('.'))
  const pkCols = new Set(getPkFields(model).map(f => f.dbColumn))
  const N = model.name

  // caminho do atributo para consultas (a coluna da chave composta fica dentro do id)
  const rootPath = (column: string) => (isComposite && pkCols.has(column) ? `root.get("id").get("${toCamelCase(column)}")` : `root.get("${toCamelCase(column)}")`)
  const idEquals = isComposite
    ? getPkFields(model).map(f => `cb.equal(root.get("id").get("${toCamelCase(f.dbColumn)}"), id.get${cap(toCamelCase(f.dbColumn))}())`).join(',\n                ')
    : `cb.equal(root.get("${toCamelCase((getEffectivePkField(model) ?? { dbColumn: 'id' }).dbColumn)}"), id)`

  // leitura/gravação por coluna (usadas pela conferência das regras)
  const getCases = fields.map(f => {
    const g = `get${cap(toCamelCase(f.dbColumn))}`
    return isComposite && pkCols.has(f.dbColumn)
      ? `                case ${J(f.dbColumn.toLowerCase())}: return e.getId() == null ? null : e.getId().${g}();`
      : `                case ${J(f.dbColumn.toLowerCase())}: return e.${g}();`
  })
  const setCases = fields.filter(f => !(isComposite && pkCols.has(f.dbColumn)) && toJavaType(f.dataType) !== 'byte[]').map(f => {
    const s = `set${cap(toCamelCase(f.dbColumn))}`
    return `                case ${J(f.dbColumn.toLowerCase())}: e.${s}(${javaParseExpr(toJavaType(f.dataType), 'value')}); return;`
  })

  // auditoria: colunas reais da tabela, com o tipo do atributo
  const cols = model.audit?.columns || {}
  const fieldOf = (col?: string) => (col ? fields.find(f => f.dbColumn.toLowerCase() === col.toLowerCase() && !pkCols.has(f.dbColumn)) : undefined)
  const stampLines: string[] = []
  const stampAt = (col: string | undefined, onlyInsert: boolean) => {
    const f = fieldOf(col)
    const now = f ? NOW[toJavaType(f.dataType)] : undefined
    if (!f || !now) return
    stampLines.push(`            ${onlyInsert ? 'if (insert) ' : ''}e.set${cap(toCamelCase(f.dbColumn))}(${now});`)
  }
  const stampBy = (col: string | undefined, onlyInsert: boolean) => {
    const f = fieldOf(col)
    if (!f) return
    const setter = `e.set${cap(toCamelCase(f.dbColumn))}`
    const parse = javaParseExpr(toJavaType(f.dataType), 'actor')
    // sem o dado do usuário a coluna fica vazia no cadastro; na edição o valor anterior é mantido
    if (onlyInsert) stampLines.push(`            if (insert) { ${setter}(null); }`)
    stampLines.push(`            if (actor != null) { try { ${onlyInsert ? 'if (insert) ' : ''}${setter}(${parse}); } catch (RuntimeException ignored) { } }`)
  }
  stampAt(cols.createdAt, true)
  stampBy(cols.createdBy, true)
  stampAt(cols.updatedAt, false)
  stampBy(cols.updatedBy, false)

  const imports = [
    `import ${groupId}.access.AccessEnforcer;`,
    `import ${groupId}.access.PolicySpecs;`,
    `import ${groupId}.entities.${N};`,
    isComposite ? `import ${groupId}.entities.${N}Id;` : ``,
    `import ${groupId}.repositories.${N}Repository;`,
    hasGrid ? `import ${groupId}.dto.${N}ListView;` : ``,
    `import ${groupId}.specifications.${N}Spec;`,
    `import lombok.RequiredArgsConstructor;`,
    `import org.springframework.data.domain.*;`,
    `import org.springframework.data.jpa.domain.Specification;`,
    `import org.springframework.stereotype.Service;`,
    `import java.util.*;`,
    (!isComposite && pkType === 'UUID') ? `import java.util.UUID;` : ``,
    (!isComposite && pkType === 'BigDecimal') ? `import java.math.BigDecimal;` : ``,
    ...cascade.imports,
  ].filter(Boolean).join('\n')

  return `package ${groupId}.services;

${imports}

@Service
@RequiredArgsConstructor
public class ${N}Service {

    private static final String TABLE = ${J(table)};

    private final ${N}Repository repository;
    private final AccessEnforcer access;
${cascade.fieldCode}
    /** Linhas que o usuário da requisição pode ver (regras por linha e "bloquear por padrão"). */
    private Specification<${N}> scope() {
        return PolicySpecs.scope(TABLE, access.resolve(TABLE));
    }

    private Pageable pageable(int page, int size, String sort) {
        Sort s = (sort != null && !sort.isEmpty()) ? Sort.by(sort) : Sort.unsorted();
        return PageRequest.of(page, size, s);
    }

    public Page<${N}> findAll(int page, int size, String sort) {
        return repository.findAll(scope(), pageable(page, size, sort));
    }

    public Page<${N}> search(Map<String, String> params, int page, int size, String sort) {
        return repository.findAll(Specification.where(${N}Spec.fromParams(params)).and(scope()), pageable(page, size, sort));
    }
${hasGrid ? `
    public Page<${N}ListView> findAllProjected(int page, int size, String sort) {
        Pageable pageable = pageable(page, size, sort);
        return repository.findBy(scope(), q -> q.as(${N}ListView.class).page(pageable));
    }
` : ''}${incomingFks.map(fk => {
    const f = fields.find(x => x.dbColumn === fk.fkField)
    return `
    public Page<${N}> findBy${fk.fkCamel}(${fk.fkJavaType} id, int page, int size, String sort) {
        Specification<${N}> spec = (root, query, cb) -> cb.equal(${rootPath(f ? f.dbColumn : fk.fkField)}, id);
        return repository.findAll(Specification.where(spec).and(scope()), pageable(page, size, sort));
    }
`
  }).join('')}
    public Optional<${N}> findById(${pkType} id) {
        Specification<${N}> byId = (root, query, cb) -> cb.and(
                ${idEquals});
        return repository.findOne(Specification.where(byId).and(scope()));
    }

    /** Cadastro: confere permissão e regras, carimba a auditoria e grava. */
    public ${N} save(${N} entity) {
        access.checkWrite(TABLE, true, entity, COLUMNS);
        return repository.save(entity);
    }

    /** Edição: confere permissão e regras sobre o registro já alterado, carimba a auditoria e grava. */
    public ${N} update(${N} entity) {
        access.checkWrite(TABLE, false, entity, COLUMNS);
        return repository.save(entity);
    }

${cascade.bodyCode ? '    @Transactional\n' : ''}    public void delete(${pkType} id) {
${cascade.bodyCode}        repository.deleteById(id);
    }

    public Map<String, Object> getAnalyticsSummary() {
        Map<String, Object> summary = new HashMap<>();
        summary.put("totalRecords", repository.count(scope()));
        return summary;
    }

    private static final AccessEnforcer.EntityAccess<${N}> COLUMNS = new AccessEnforcer.EntityAccess<>() {
        @Override
        public Object get(${N} e, String column) {
            switch (column.toLowerCase()) {
${getCases.join('\n')}
                default: throw new IllegalArgumentException("Coluna desconhecida: " + column);
            }
        }

        @Override
        public void set(${N} e, String column, String value) {
            switch (column.toLowerCase()) {
${setCases.join('\n')}
                default: throw new IllegalArgumentException("Coluna desconhecida: " + column);
            }
        }

        @Override
        public void stamp(${N} e, boolean insert, String actor) {
${stampLines.join('\n')}
        }
    };
}
`
}

