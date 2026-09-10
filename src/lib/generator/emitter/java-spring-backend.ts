import { AppAST, ModelNode, FieldNode } from '../ast'

/**
 * java-spring-backend.ts — Gerador do backend Spring Boot 3.x (Módulos 5 + 8)
 *
 * Gera todos os arquivos prefixados com 'backend/':
 *   backend/pom.xml
 *   backend/src/main/resources/application.properties
 *   backend/src/main/java/{groupPath}/Application.java
 *   backend/src/main/java/{groupPath}/config/CorsConfig.java
 *   backend/src/main/java/{groupPath}/config/OpenApiConfig.java
 *   backend/src/main/java/{groupPath}/entities/{Model}.java
 *   backend/src/main/java/{groupPath}/repositories/{Model}Repository.java
 *   backend/src/main/java/{groupPath}/services/{Model}Service.java
 *   backend/src/main/java/{groupPath}/controllers/{Model}Controller.java
 *   backend/README.md
 */
export function generateSpringBootBackend(ast: AppAST, files: Map<string, string>): void {
  const groupId = (ast.javaGroupId ?? 'com.app').toLowerCase()
  const groupPath = groupIdToPath(groupId)
  const basePkg = `backend/src/main/java/${groupPath}`

  // 1. pom.xml
  files.set('backend/pom.xml', generatePomXml(ast))

  // 2. application.properties
  files.set('backend/src/main/resources/application.properties', generateApplicationProperties(ast))

  // 3. Application.java (main class)
  files.set(`${basePkg}/Application.java`, generateMainClass(ast, groupId))

  // 4. Config: CorsConfig + OpenApiConfig
  files.set(`${basePkg}/config/CorsConfig.java`, generateCorsConfig(ast, groupId))
  files.set(`${basePkg}/config/OpenApiConfig.java`, generateOpenApiConfig(ast, groupId))

  // 5. Por modelo: Entity, Repository, Service, Controller
  for (const model of ast.models) {
    files.set(`${basePkg}/entities/${model.name}.java`, generateEntityClass(model, ast, groupId))
    files.set(`${basePkg}/repositories/${model.name}Repository.java`, generateRepositoryInterface(model, ast, groupId))
    files.set(`${basePkg}/services/${model.name}Service.java`, generateServiceClass(model, ast, groupId))
    files.set(`${basePkg}/controllers/${model.name}Controller.java`, generateControllerClass(model, ast, groupId))
  }

  // 6. README
  files.set('backend/README.md', generateBackendReadme(ast))
}

// ─────────────────────────────────────────────────────────────────────────────
// Módulo 8 — Utilitários Java (Funções de Apoio)
// ─────────────────────────────────────────────────────────────────────────────

/** Converte snake_case para camelCase */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

/** Converte snake_case para PascalCase */
function toPascalCaseJava(str: string): string {
  const camel = toCamelCase(str)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

/** Mapeia dbType para tipo Java */
function toJavaType(dataType: string): string {
  const map: Record<string, string> = {
    varchar: 'String', text: 'String', char: 'String', 'character varying': 'String',
    integer: 'Integer', int4: 'Integer', int: 'Integer',
    bigint: 'Long', int8: 'Long', serial: 'Long', bigserial: 'Long',
    numeric: 'BigDecimal', decimal: 'BigDecimal', 'double precision': 'Double',
    float4: 'Float', float8: 'Double', real: 'Float',
    boolean: 'Boolean', bool: 'Boolean',
    date: 'LocalDate',
    timestamp: 'LocalDateTime', 'timestamp without time zone': 'LocalDateTime',
    timestamptz: 'OffsetDateTime', 'timestamp with time zone': 'OffsetDateTime',
    uuid: 'UUID', json: 'String', jsonb: 'String',
    bytea: 'byte[]',
  }
  return map[dataType.toLowerCase()] ?? 'String'
}

/** Retorna os imports Java necessários dado o conjunto de tipos usados */
function getJavaImports(types: Set<string>): string[] {
  const importMap: Record<string, string> = {
    BigDecimal: 'java.math.BigDecimal',
    LocalDate: 'java.time.LocalDate',
    LocalDateTime: 'java.time.LocalDateTime',
    OffsetDateTime: 'java.time.OffsetDateTime',
    UUID: 'java.util.UUID',
    List: 'java.util.List',
    ArrayList: 'java.util.ArrayList',
    JsonIgnore: 'com.fasterxml.jackson.annotation.JsonIgnore',
    Float: '',  // java.lang — não precisa importar
    Double: '', // java.lang — não precisa importar
  }
  return [...types]
    .flatMap(t => importMap[t] ? [`import ${importMap[t]};`] : [])
    .filter(Boolean)
}

/** Converte groupId (ex: 'com.app') para caminho de pasta (ex: 'com/app') */
function groupIdToPath(groupId: string): string {
  return groupId.replace(/\./g, '/')
}

/** Determina o tipo Java da PK de um modelo */
function getPkJavaType(model: ModelNode): string {
  const pkField = model.fields.find(f => f.isPrimary)
  if (!pkField) return 'Long'
  return toJavaType(pkField.dataType)
}

/** Determina o nome camelCase do campo PK */
function getPkFieldName(model: ModelNode): string {
  const pkField = model.fields.find(f => f.isPrimary)
  return pkField ? toCamelCase(pkField.dbColumn) : 'id'
}

/** Sanitiza nome de tabela para uso em @RequestMapping (hífens → underscores) */
function sanitizeTableForMapping(table: string): string {
  return table.replace(/-/g, '_')
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.2 — pom.xml
// ─────────────────────────────────────────────────────────────────────────────

function generatePomXml(ast: AppAST): string {
  const groupId = (ast.javaGroupId ?? 'com.app').toLowerCase()
  const artifactId = ast.javaArtifactId ?? `${ast.projectSlug}-backend`
  const javaVersion = ast.javaVersion ?? 21
  const enablePreview = javaVersion === 21
    ? `
      <compilerArgs>
        <arg>--enable-preview</arg>
      </compilerArgs>` : ''

  const dbDriver = (() => {
    switch (ast.dbStack) {
      case 'postgres':
      case 'supabase': // supabase É postgres
        return `
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>`
      case 'mysql':
        return `
    <dependency>
      <groupId>com.mysql</groupId>
      <artifactId>mysql-connector-j</artifactId>
      <scope>runtime</scope>
    </dependency>`
      case 'sqlserver':
        return `
    <dependency>
      <groupId>com.microsoft.sqlserver</groupId>
      <artifactId>mssql-jdbc</artifactId>
      <scope>runtime</scope>
    </dependency>`
      case 'oracle':
        return `
    <dependency>
      <groupId>com.oracle.database.jdbc</groupId>
      <artifactId>ojdbc11</artifactId>
      <scope>runtime</scope>
    </dependency>`
      default:
        return ''
    }
  })()

  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.0</version>
    <relativePath/>
  </parent>

  <groupId>${groupId}</groupId>
  <artifactId>${artifactId}</artifactId>
  <version>1.0.0</version>
  <name>${ast.projectName} Backend</name>
  <description>API REST gerada pelo MetaBuilder Pro</description>

  <properties>
    <java.version>${javaVersion}</java.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springdoc</groupId>
      <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
      <version>2.5.0</version>
    </dependency>
    <dependency>
      <groupId>org.projectlombok</groupId>
      <artifactId>lombok</artifactId>
      <optional>true</optional>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-devtools</artifactId>
      <scope>runtime</scope>
      <optional>true</optional>
    </dependency>${dbDriver}
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
        <configuration>
          <excludes>
            <exclude>
              <groupId>org.projectlombok</groupId>
              <artifactId>lombok</artifactId>
            </exclude>
          </excludes>
        </configuration>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <configuration>${enablePreview}
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.3 — application.properties
// ─────────────────────────────────────────────────────────────────────────────

function generateApplicationProperties(ast: AppAST): string {
  const port = ast.javaPort ?? 8080
  const javaVersion = ast.javaVersion ?? 21
  const dbConn = ast.dbConnectionString

  let jdbcUrl = ''
  let username = ''
  let password = ''

  if (dbConn) {
    try {
      const uriStr = dbConn.startsWith('jdbc:') ? dbConn.substring(5) : dbConn
      // Garante que tenha protocolo para o URL parser funcionar (ex: postgresql://)
      const parseableUri = uriStr.includes('://') ? uriStr : `postgresql://${uriStr}`
      const uri = new URL(parseableUri)
      
      const host = uri.hostname
      const portNum = uri.port
      const dbName = uri.pathname
      username = uri.username
      password = uri.password
      
      const portStr = portNum ? `:${portNum}` : ''
      
      switch (ast.dbStack) {
        case 'postgres':
        case 'supabase':
          jdbcUrl = `jdbc:postgresql://${host}${portStr}${dbName}${ast.dbStack === 'supabase' ? '?sslmode=require' : ''}`
          break
        case 'mysql':
          jdbcUrl = `jdbc:mysql://${host}${portStr}${dbName}?useSSL=false&allowPublicKeyRetrieval=true`
          break
        case 'sqlserver':
          jdbcUrl = `jdbc:sqlserver://${host}${portStr}${dbName}`
          break
        case 'oracle':
          jdbcUrl = `jdbc:oracle:thin:@//${host}${portStr}${dbName}`
          break
        default:
          jdbcUrl = `jdbc:postgresql://${host}${portStr}${dbName}`
      }
    } catch (e) {
      // Fallback
      const dbStr = dbConn.startsWith('jdbc:') ? dbConn.substring(5) : dbConn
      switch (ast.dbStack) {
        case 'postgres': jdbcUrl = `jdbc:postgresql://${dbStr}`; break
        case 'supabase': jdbcUrl = `jdbc:postgresql://${dbStr}?sslmode=require`; break
        case 'mysql': jdbcUrl = `jdbc:mysql://${dbStr}?useSSL=false&allowPublicKeyRetrieval=true`; break
        case 'sqlserver': jdbcUrl = `jdbc:sqlserver://${dbStr}`; break
        case 'oracle': jdbcUrl = `jdbc:oracle:thin:@//${dbStr}`; break
        default: jdbcUrl = `jdbc:postgresql://${dbStr}`
      }
    }
  }

  const datasourceLines = jdbcUrl
    ? [
        `spring.datasource.url=${jdbcUrl}`,
        `spring.datasource.username=${username || '# PREENCHER: usuário do banco'}`,
        `spring.datasource.password=${password || '# PREENCHER: senha do banco'}`,
      ]
    : [
        `# PREENCHER: configure a URL JDBC do banco de dados`,
        `# spring.datasource.url=jdbc:postgresql://localhost:5432/nome_do_banco`,
        `# spring.datasource.username=usuario`,
        `# spring.datasource.password=senha`,
      ]

  const driverClass = (() => {
    switch (ast.dbStack) {
      case 'postgres':
      case 'supabase': return 'org.postgresql.Driver'
      case 'mysql': return 'com.mysql.cj.jdbc.Driver'
      case 'sqlserver': return 'com.microsoft.sqlserver.jdbc.SQLServerDriver'
      case 'oracle': return 'oracle.jdbc.OracleDriver'
      default: return 'org.postgresql.Driver'
    }
  })()

  const lines: string[] = [
    `# ── Servidor ──`,
    `server.port=${port}`,
    ``,
    `# ── Datasource ──`,
    ...datasourceLines,
    `spring.datasource.driver-class-name=${driverClass}`,
    ``,
    `# ── JPA / Hibernate ──`,
    `spring.jpa.hibernate.ddl-auto=validate`,
    `spring.jpa.show-sql=false`,
    `spring.jpa.properties.hibernate.format_sql=true`,
    ``,
    `# ── CORS ──`,
    `app.cors.allowed-origins=http://localhost:3000`,
    ``,
    `# ── OpenAPI / Swagger ──`,
    `springdoc.api-docs.path=/api-docs`,
    `springdoc.swagger-ui.path=/swagger-ui.html`,
  ]

  // Virtual Threads (Project Loom) — Java 21
  if (javaVersion === 21) {
    lines.push(``)
    lines.push(`# ── Virtual Threads (Project Loom — Java 21) ──`)
    lines.push(`spring.threads.virtual.enabled=true`)
  }

  return lines.join('\n') + '\n'
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.4 — Application.java
// ─────────────────────────────────────────────────────────────────────────────

function generateMainClass(ast: AppAST, groupId: string): string {
  return `package ${groupId};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.9 — CorsConfig.java
// ─────────────────────────────────────────────────────────────────────────────

function generateCorsConfig(ast: AppAST, groupId: string): string {
  return `package ${groupId}.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class CorsConfig {

    @Value("\${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.10 — OpenApiConfig.java
// ─────────────────────────────────────────────────────────────────────────────

function generateOpenApiConfig(ast: AppAST, groupId: string): string {
  return `package ${groupId}.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("${ast.projectName} API")
                .description("API REST gerada pelo MetaBuilder Pro")
                .version("1.0.0"));
    }
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.5 — Entity.java
// ─────────────────────────────────────────────────────────────────────────────

interface InverseRelation {
  sourceModel: string
  sourceTable: string
  foreignKey: string
  propertyName: string
}

function resolveFieldRelation(field: FieldNode, ast: AppAST): { targetModel: string, targetTable: string } | null {
  const rel = field.config?.relation || field.relation
  if (rel) {
    const targetTbl = ('targetTable' in rel ? (rel.targetTable || '') : '').toLowerCase()
    const targetModelName = rel.targetModel || ''
    return { targetModel: targetModelName, targetTable: targetTbl }
  }
  
  if (field.isPrimary) return null

  // Fallback: tenta deduzir FK pelo nome (ex: cliente_id -> clientes)
  const col = field.dbColumn.toLowerCase()
  if (col.endsWith('_id') || col.startsWith('id_')) {
    const base = col.endsWith('_id') ? col.slice(0, -3) : col.slice(3)
    const candidates = [base, `${base}s`]
    for (const cand of candidates) {
      const match = ast.models.find(m => m.dbTable.toLowerCase() === cand || m.name.toLowerCase() === cand)
      if (match) return { targetModel: match.name, targetTable: match.dbTable }
    }
  }
  return null
}

function getInverseRelations(model: ModelNode, ast: AppAST): InverseRelation[] {
  const inverses: InverseRelation[] = []
  for (const m of ast.models) {
    if (m.id === model.id) continue
    for (const f of m.fields) {
      const rel = resolveFieldRelation(f, ast)
      if (rel) {
        if (rel.targetTable.toLowerCase() === model.dbTable.toLowerCase() || rel.targetModel === model.name) {
          const camelName = toCamelCase(f.dbColumn)
          const propName = camelName.endsWith('Id') ? camelName.slice(0, -2) : (camelName.endsWith('id') ? camelName.slice(0, -2) : camelName + 'Ref')
          inverses.push({
            sourceModel: m.name,
            sourceTable: m.dbTable,
            foreignKey: f.dbColumn,
            propertyName: propName
          })
        }
      }
    }
  }
  return inverses
}

function generateEntityClass(model: ModelNode, ast: AppAST, groupId: string): string {
  const javaTypes = new Set<string>()

  // Filtrar campos virtuais (JOIN — contêm ponto)
  const entityFields = model.fields.filter(f => !f.dbColumn.includes('.'))

  const fieldLines: string[] = []
  let pkGenerated = false

  for (const field of entityFields) {
    const jt = toJavaType(field.dataType)
    if (!javaTypes.has(jt) && jt.includes('java.util.')) javaTypes.add(jt)
    const camelName = toCamelCase(field.dbColumn)

    if (field.isPrimary && !pkGenerated) {
      pkGenerated = true
      fieldLines.push(`    @Id`)
      fieldLines.push(`    @GeneratedValue(strategy = GenerationType.IDENTITY)`)
      fieldLines.push(`    @Column(name = "${field.dbColumn}")`)
      fieldLines.push(`    private ${jt} ${camelName};`)
    } else {
      const rel = resolveFieldRelation(field, ast)
      if (rel && !field.isPrimary) {
        const targetPascal = rel.targetModel || toPascalCaseJava(rel.targetTable || '')
        const propName = camelName.endsWith('Id') ? camelName.slice(0, -2) : (camelName.endsWith('id') ? camelName.slice(0, -2) : camelName + 'Ref')
        fieldLines.push(`    @ManyToOne(fetch = FetchType.LAZY)`)
        fieldLines.push(`    @JoinColumn(name = "${field.dbColumn}")`)
        fieldLines.push(`    private ${targetPascal} ${propName};`)
      } else {
        fieldLines.push(`    @Column(name = "${field.dbColumn}")`)
        fieldLines.push(`    private ${jt} ${camelName};`)
      }
    }
    fieldLines.push(``)
  }

  const inverseRels = getInverseRelations(model, ast)
  for (const inv of inverseRels) {
    javaTypes.add('List')
    javaTypes.add('ArrayList')
    javaTypes.add('JsonIgnore')
    const listProp = toCamelCase(inv.sourceTable)
    fieldLines.push(`    @OneToMany(mappedBy = "${inv.propertyName}", cascade = CascadeType.ALL, orphanRemoval = true)`)
    fieldLines.push(`    @JsonIgnore`)
    fieldLines.push(`    private List<${inv.sourceModel}> ${listProp} = new ArrayList<>();`)
    fieldLines.push(``)
  }

  // Edge case: nenhum campo com isPrimary — adicionar @Id ao primeiro campo
  if (!pkGenerated && entityFields.length > 0) {
    const firstField = entityFields[0]
    const jt = toJavaType(firstField.dataType)
    const camelName = toCamelCase(firstField.dbColumn)
    fieldLines.unshift(
      `    // WARNING: nenhum campo marcado como PK — usando o primeiro campo como @Id`,
      `    @Id`,
      `    @GeneratedValue(strategy = GenerationType.IDENTITY)`,
      `    @Column(name = "${firstField.dbColumn}")`,
      `    private ${jt} ${camelName};`,
      ``,
    )
    javaTypes.add(jt)
  }

  const imports = [
    `import jakarta.persistence.*;`,
    `import lombok.Data;`,
    ...getJavaImports(javaTypes),
  ].join('\n')

  return `package ${groupId}.entities;

${imports}

@Entity
@Table(name = "${model.dbTable}")
@Data
public class ${model.name} {

${fieldLines.join('\n')}
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.6 — Repository.java
// ─────────────────────────────────────────────────────────────────────────────

function generateRepositoryInterface(model: ModelNode, ast: AppAST, groupId: string): string {
  const pkType = getPkJavaType(model)
  const pkFieldPascal = toPascalCaseJava(getPkFieldName(model))

  return `package ${groupId}.repositories;

import ${groupId}.entities.${model.name};
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
${pkType === 'UUID' ? 'import java.util.UUID;' : ''}

@Repository
public interface ${model.name}Repository extends JpaRepository<${model.name}, ${pkType}> {
    List<${model.name}> findBy${pkFieldPascal}In(List<${pkType}> ids);
    Page<${model.name}> findAll(Pageable pageable);
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.7 — Service.java
// ─────────────────────────────────────────────────────────────────────────────

function generateServiceClass(model: ModelNode, ast: AppAST, groupId: string): string {
  const pkType = getPkJavaType(model)

  return `package ${groupId}.services;

import ${groupId}.entities.${model.name};
import ${groupId}.repositories.${model.name}Repository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import java.util.*;
${pkType === 'UUID' ? 'import java.util.UUID;' : ''}

@Service
@RequiredArgsConstructor
public class ${model.name}Service {

    private final ${model.name}Repository repository;

    public Page<${model.name}> findAll(int page, int size, String sort) {
        Sort s = (sort != null && !sort.isEmpty()) ? Sort.by(sort) : Sort.unsorted();
        return repository.findAll(PageRequest.of(page, size, s));
    }

    public Optional<${model.name}> findById(${pkType} id) {
        return repository.findById(id);
    }

    public ${model.name} save(${model.name} entity) {
        return repository.save(entity);
    }

    public void delete(${pkType} id) {
        repository.deleteById(id);
    }
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.8 — Controller.java
// ─────────────────────────────────────────────────────────────────────────────

function generateControllerClass(model: ModelNode, ast: AppAST, groupId: string): string {
  const pkType = getPkJavaType(model)
  const mapping = sanitizeTableForMapping(model.dbTable)
  const uuidImport = pkType === 'UUID' ? 'import java.util.UUID;' : ''

  return `package ${groupId}.controllers;

import ${groupId}.entities.${model.name};
import ${groupId}.services.${model.name}Service;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
${uuidImport}

@RestController
@RequestMapping("/api/${mapping}")
@RequiredArgsConstructor
@CrossOrigin(origins = "\${app.cors.allowed-origins}")
public class ${model.name}Controller {

    private final ${model.name}Service service;

    @GetMapping
    public ResponseEntity<Page<${model.name}>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String sort) {
        return ResponseEntity.ok(service.findAll(page, size, sort));
    }

    @GetMapping("/{id}")
    public ResponseEntity<${model.name}> getById(@PathVariable ${pkType} id) {
        return service.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<${model.name}> create(@RequestBody @Valid ${model.name} entity) {
        return ResponseEntity.status(201).body(service.save(entity));
    }

    @PutMapping("/{id}")
    public ResponseEntity<${model.name}> update(
            @PathVariable ${pkType} id,
            @RequestBody ${model.name} entity) {
        if (service.findById(id).isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(service.save(entity));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable ${pkType} id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.11 — README.md do backend
// ─────────────────────────────────────────────────────────────────────────────

function generateBackendReadme(ast: AppAST): string {
  const port = ast.javaPort ?? 8080
  const javaVersion = ast.javaVersion ?? 21

  return `# ${ast.projectName} — Backend (Spring Boot ${javaVersion})

## Pré-requisitos
- JDK ${javaVersion} ([Adoptium Temurin](https://adoptium.net))
- Maven 3.9+ (ou use o Maven Wrapper incluído: \`./mvnw\`)

## Configuração
Edite \`src/main/resources/application.properties\`:
\`\`\`properties
spring.datasource.url=jdbc:...   # configure sua URL JDBC
spring.datasource.username=...
spring.datasource.password=...
\`\`\`

## Executar
\`\`\`bash
cd backend
mvn spring-boot:run
# ou: ./mvnw spring-boot:run

# Acesse: http://localhost:${port}
# Swagger: http://localhost:${port}/swagger-ui.html
\`\`\`

## Endpoints gerados
${ast.models.map(m => {
  const t = sanitizeTableForMapping(m.dbTable)
  return [
    `### ${m.name}`,
    `- \`GET    /api/${t}\` — listar (paginado: ?page=0&size=50&sort=campo)`,
    `- \`GET    /api/${t}/{id}\` — buscar por ID`,
    `- \`POST   /api/${t}\` — criar`,
    `- \`PUT    /api/${t}/{id}\` — atualizar`,
    `- \`DELETE /api/${t}/{id}\` — excluir`,
  ].join('\n')
}).join('\n\n')}

## Arquitetura
\`\`\`
Application.java          ← Entry point
config/
  CorsConfig.java         ← CORS configurado para http://localhost:3000
  OpenApiConfig.java      ← Swagger/OpenAPI 3.x
entities/                 ← @Entity JPA por tabela
repositories/             ← JpaRepository por entidade
services/                 ← Regras de negócio
controllers/              ← @RestController por entidade
\`\`\`
${javaVersion === 21 ? '\n## Virtual Threads (Project Loom)\nEste projeto usa `spring.threads.virtual.enabled=true` para máxima concorrência com Java 21.\n' : ''}
`
}
