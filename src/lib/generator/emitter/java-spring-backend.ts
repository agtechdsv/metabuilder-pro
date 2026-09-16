import { AppAST, ModelNode, FieldNode, RouteNode, DbType } from '../ast'

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

  // Índice de rotas por modelName e modelTable — lookup O(1) em todos os geradores
  const routeMap = new Map<string, RouteNode>()
  for (const route of ast.routes) {
    routeMap.set(route.modelName, route)
    routeMap.set(route.modelTable, route)
  }

  // 1. pom.xml
  files.set('backend/pom.xml', generatePomXml(ast))

  // 2. application.properties
  files.set('backend/src/main/resources/application.properties', generateApplicationProperties(ast))

  // 3. Application.java (main class)
  files.set(`${basePkg}/Application.java`, generateMainClass(ast, groupId))

  // 4. Config: CorsConfig + OpenApiConfig
  files.set(`${basePkg}/config/CorsConfig.java`, generateCorsConfig(ast, groupId))
  files.set(`${basePkg}/config/OpenApiConfig.java`, generateOpenApiConfig(ast, groupId))

  // 5. Por modelo: Entity, Repository, Service, Controller + Specification
  for (const model of ast.models) {
    const route = routeMap.get(model.name) ?? routeMap.get(model.dbTable)

    // Se o modelo tem chave composta, gera a classe @Embeddable separada
    if (hasCompositePk(model)) {
      files.set(`${basePkg}/entities/${model.name}Id.java`, generateEmbeddableIdClass(model, groupId))
    }

    files.set(`${basePkg}/entities/${model.name}.java`, generateEntityClass(model, ast, groupId))
    files.set(`${basePkg}/repositories/${model.name}Repository.java`, generateRepositoryInterface(model, ast, groupId, route))
    files.set(`${basePkg}/services/${model.name}Service.java`, generateServiceClass(model, ast, groupId, route))
    files.set(`${basePkg}/controllers/${model.name}Controller.java`, generateControllerClass(model, ast, groupId, route))

    // Specification (pesquisa dinâmica) — gerada para todos os modelos
    files.set(`${basePkg}/specifications/${model.name}Spec.java`,
      generateSpecificationClass(model, ast, groupId, route))

    // Projeções (DTOs para Grid) — evita trafegar a entidade inteira
    if (route && route.gridFields && route.gridFields.length > 0) {
      files.set(`${basePkg}/dto/${model.name}ListView.java`,
        generateProjectionInterface(model, ast, groupId, route))
    }
  }

  // 6. README
  files.set('backend/README.md', generateBackendReadme(ast))

  // 7. Eject Options Condicionais (JWT, Migrations, Testes, Dockerfile, docker-compose, .env.example)
  if (ast.jwtEnabled) generateJwtFiles(ast, files, basePkg, groupId)
  if (ast.generateMigrations) generateMigrationFiles(ast, files)
  if (ast.generateServiceTests || ast.generateControllerTests) generateTestFiles(ast, files, groupId)
  if (ast.generateDockerfile) files.set('backend/Dockerfile', generateBackendDockerfile(ast))
  if (ast.generateDockerCompose) files.set('docker-compose.yml', generateDockerCompose(ast))
  if (ast.generateEnvExample) files.set('backend/.env.example', generateEnvExample(ast))
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

/**
 * Normaliza tipos de banco para um canônico mínimo usado pelo gerador de Specification.
 * Funciona para Postgres, Oracle, MySQL e SQL Server.
 */
function canonicalDbType(rawType: string): string {
  const t = (rawType ?? '').toLowerCase().trim().replace(/\(.*\)/, '').trim()
  if (t === 'varchar' || t === 'nvarchar' || t === 'nvarchar2' || t === 'varchar2' ||
      t === 'character varying' || t === 'text' || t === 'ntext' ||
      t === 'clob' || t === 'nclob' || t === 'char' || t === 'nchar') return 'varchar'
  if (t === 'integer' || t === 'int' || t === 'int4' || t === 'bigint' ||
      t === 'int8' || t === 'serial' || t === 'bigserial' || t === 'smallint') return 'integer'
  if (t === 'numeric' || t === 'decimal' || t === 'number' ||
      t === 'double precision' || t === 'real' || t === 'float4' || t === 'float8') return 'numeric'
  if (t === 'boolean' || t === 'bool') return 'boolean'
  if (t === 'date') return 'date'
  if (t.startsWith('timestamp') || t === 'datetime' || t === 'datetime2') return 'timestamp'
  if (t === 'uuid' || t === 'uniqueidentifier') return 'uuid'
  return 'varchar'
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
    JdbcTypeCode: 'org.hibernate.annotations.JdbcTypeCode',
    SqlTypes: 'org.hibernate.type.SqlTypes',
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

/** Retorna todos os campos marcados como PK (sem ponto) */
function getPkFields(model: ModelNode) {
  return model.fields.filter(f => f.isPrimary && !f.dbColumn.includes('.'))
}

/** Detecta se o modelo possui chave composta (mais de 1 PK real) */
function hasCompositePk(model: ModelNode): boolean {
  return getPkFields(model).length > 1
}

/** Determina o tipo Java da PK de um modelo */
function getPkJavaType(model: ModelNode): string {
  if (hasCompositePk(model)) return `${model.name}Id`
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

  const jwtDeps = ast.jwtEnabled ? `
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
      <groupId>io.jsonwebtoken</groupId>
      <artifactId>jjwt-api</artifactId>
      <version>0.11.5</version>
    </dependency>
    <dependency>
      <groupId>io.jsonwebtoken</groupId>
      <artifactId>jjwt-impl</artifactId>
      <version>0.11.5</version>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>io.jsonwebtoken</groupId>
      <artifactId>jjwt-jackson</artifactId>
      <version>0.11.5</version>
      <scope>runtime</scope>
    </dependency>` : ''

  const flywayDep = (ast.generateMigrations && ast.migrationEngine !== 'liquibase') ? `
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-core</artifactId>
    </dependency>` : ''

  const liquibaseDep = (ast.generateMigrations && ast.migrationEngine === 'liquibase') ? `
    <dependency>
      <groupId>org.liquibase</groupId>
      <artifactId>liquibase-core</artifactId>
    </dependency>` : ''

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
    </dependency>${dbDriver}${jwtDeps}${flywayDep}${liquibaseDep}
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
    `spring.jpa.properties.hibernate.format_sql=false`,
    `spring.jpa.properties.hibernate.highlight_sql=false`,
    ``,
    `# ── Spring Data Web Pageable (DTO serialization) ──`,
    `spring.data.web.pageable.page-serialization-mode=via-dto`,
    ``,
    `# ── Logging SQL & Connection Pool ──`,
    `logging.level.org.hibernate.SQL=DEBUG`,
    `logging.level.org.hibernate.orm.jdbc.bind=TRACE`,
    `logging.level.com.zaxxer.hikari=INFO`,
    ``,
    `# ── CORS ──`,
    `app.cors.allowed-origins=http://localhost:3000`,
    ``,
    `# ── Jackson JSON Serialization (snake_case) ──`,
    `spring.jackson.property-naming-strategy=SNAKE_CASE`,
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

  if (ast.jwtEnabled) {
    lines.push(
      ``,
      `# ── JWT Security ──`,
      `jwt.secret=\${JWT_SECRET:minha-chave-secreta-256-bits-super-segura-e-longa-32bytes}`,
      `jwt.expiration-ms=\${JWT_EXPIRATION_MS:86400000}`
    )
  }

  if (ast.generateMigrations && ast.migrationEngine !== 'liquibase') {
    lines.push(
      ``,
      `# ── Flyway Migrations ──`,
      `spring.flyway.enabled=true`,
      `spring.flyway.locations=classpath:db/migration`,
      `spring.flyway.baseline-on-migrate=true`,
      `spring.jpa.hibernate.ddl-auto=validate`
    )
  }

  if (ast.generateMigrations && ast.migrationEngine === 'liquibase') {
    lines.push(
      ``,
      `# ── Liquibase Migrations ──`,
      `spring.liquibase.enabled=true`,
      `spring.liquibase.change-log=classpath:db/changelog/db.changelog-master.yaml`,
      `spring.jpa.hibernate.ddl-auto=validate`
    )
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

// ─────────────────────────────────────────────────────────────────────────────
// 5.5b — {Model}Id.java (@Embeddable para chaves compostas)
// ─────────────────────────────────────────────────────────────────────────────

function generateEmbeddableIdClass(model: ModelNode, groupId: string): string {
  const pkFields = getPkFields(model)
  const javaTypes = new Set<string>()
  const fieldLines: string[] = []

  for (const field of pkFields) {
    const jt = toJavaType(field.dataType)
    javaTypes.add(jt)
    fieldLines.push(`    @Column(name = "${field.dbColumn}")`)
    fieldLines.push(`    @JsonProperty("${field.dbColumn}")`)
    fieldLines.push(`    private ${jt} ${toCamelCase(field.dbColumn)};`)
    fieldLines.push(``)
  }

  const imports = [
    `import jakarta.persistence.*;`,
    `import lombok.Data;`,
    `import lombok.EqualsAndHashCode;`,
    `import com.fasterxml.jackson.annotation.JsonProperty;`,
    ...getJavaImports(javaTypes),
  ].join('\n')

  return `package ${groupId}.entities;

${imports}

import java.io.Serializable;

@Embeddable
@Data
@EqualsAndHashCode
public class ${model.name}Id implements Serializable {

${fieldLines.join('\n')}
}
`
}

function generateEntityClass(model: ModelNode, ast: AppAST, groupId: string): string {
  const javaTypes = new Set<string>()

  // Filtrar campos virtuais (JOIN — contêm ponto)
  const entityFields = model.fields.filter(f => !f.dbColumn.includes('.'))
  const pkFieldNames = new Set(getPkFields(model).map(f => f.dbColumn))
  const isComposite = hasCompositePk(model)

  const fieldLines: string[] = []

  // ── Chave COMPOSTA: usar @EmbeddedId ──────────────────────────────────────
  if (isComposite) {
    const idClassName = `${model.name}Id`
    fieldLines.push(`    @EmbeddedId`)
    fieldLines.push(`    private ${idClassName} id;`)
    fieldLines.push(``)

    // Campos PK que também são FK → gerar @ManyToOne read-only
    for (const field of entityFields) {
      if (!pkFieldNames.has(field.dbColumn)) continue
      const rel = resolveFieldRelation(field, ast)
      if (!rel) continue
      const targetPascal = rel.targetModel || toPascalCaseJava(rel.targetTable || '')
      const camelName = toCamelCase(field.dbColumn)
      const propName = camelName.endsWith('Id') ? camelName.slice(0, -2) : camelName + 'Ref'
      fieldLines.push(`    @ManyToOne(fetch = FetchType.LAZY)`)
      fieldLines.push(`    @JoinColumn(name = "${field.dbColumn}", insertable = false, updatable = false)`)
      fieldLines.push(`    private ${targetPascal} ${propName};`)
      fieldLines.push(``)
    }

    // Campos não-PK normais
    for (const field of entityFields) {
      if (pkFieldNames.has(field.dbColumn)) continue
      const jt = toJavaType(field.dataType)
      javaTypes.add(jt)
      const camelName = toCamelCase(field.dbColumn)
      const rel = resolveFieldRelation(field, ast)
      if (rel) {
        const targetPascal = rel.targetModel || toPascalCaseJava(rel.targetTable || '')
        const propName = camelName.endsWith('Id') ? camelName.slice(0, -2) : camelName + 'Ref'
        fieldLines.push(`    @ManyToOne(fetch = FetchType.LAZY)`)
        fieldLines.push(`    @JoinColumn(name = "${field.dbColumn}")`)
        fieldLines.push(`    private ${targetPascal} ${propName};`)
      } else {
        if (field.dataType.toLowerCase() === 'json' || field.dataType.toLowerCase() === 'jsonb') {
          fieldLines.push(`    @JdbcTypeCode(SqlTypes.JSON)`)
          javaTypes.add('JdbcTypeCode')
          javaTypes.add('SqlTypes')
        }
        fieldLines.push(`    @Column(name = "${field.dbColumn}")`)
        fieldLines.push(`    @JsonProperty("${field.dbColumn}")`)
        fieldLines.push(`    private ${jt} ${camelName};`)
      }
      fieldLines.push(``)
    }

  // ── Chave SIMPLES (ou sem PK): comportamento original ────────────────────
  } else {
    // Pre-process: guarantee at least one primary key
    const hasPk = entityFields.some(f => f.isPrimary)
    let processedFields = entityFields
    if (!hasPk && entityFields.length > 0) {
      processedFields = [...entityFields]
      processedFields[0] = { ...processedFields[0], isPrimary: true }
    }

    let pkGenerated = false
    for (const field of processedFields) {
      const jt = toJavaType(field.dataType)
      if (!javaTypes.has(jt)) javaTypes.add(jt)
      const camelName = toCamelCase(field.dbColumn)

      const rel = resolveFieldRelation(field, ast)

      if (rel) {
        const targetPascal = rel.targetModel || toPascalCaseJava(rel.targetTable || '')
        const propName = camelName.endsWith('Id') ? camelName.slice(0, -2) : (camelName.endsWith('id') ? camelName.slice(0, -2) : camelName + 'Ref')
        
        if (field.isPrimary && !pkGenerated) {
          pkGenerated = true
          fieldLines.push(`    @Id`)
          if (field.dataType.toLowerCase() === 'json' || field.dataType.toLowerCase() === 'jsonb') {
            fieldLines.push(`    @JdbcTypeCode(SqlTypes.JSON)`)
            javaTypes.add('JdbcTypeCode')
            javaTypes.add('SqlTypes')
          }
          fieldLines.push(`    @Column(name = "${field.dbColumn}")`)
          fieldLines.push(`    @JsonProperty("${field.dbColumn}")`)
          fieldLines.push(`    private ${jt} ${camelName};`)
          fieldLines.push(``)
          fieldLines.push(`    @ManyToOne(fetch = FetchType.LAZY)`)
          fieldLines.push(`    @JoinColumn(name = "${field.dbColumn}", insertable = false, updatable = false)`)
          fieldLines.push(`    private ${targetPascal} ${propName};`)
        } else {
          fieldLines.push(`    @ManyToOne(fetch = FetchType.LAZY)`)
          fieldLines.push(`    @JoinColumn(name = "${field.dbColumn}")`)
          fieldLines.push(`    private ${targetPascal} ${propName};`)
        }
        
      } else if (field.isPrimary && !pkGenerated) {
        pkGenerated = true
        fieldLines.push(`    @Id`)
        if (ast.dbStack === 'oracle') {
          const seqName = `SEQ_${model.dbTable.toUpperCase()}`
          const genName = `${model.dbTable.toLowerCase()}_seq`
          fieldLines.push(`    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "${genName}")`)
          fieldLines.push(`    @SequenceGenerator(name = "${genName}", sequenceName = "${seqName}", allocationSize = 1)`)
        } else {
          fieldLines.push(`    @GeneratedValue(strategy = GenerationType.IDENTITY)`)
        }
        if (field.dataType.toLowerCase() === 'json' || field.dataType.toLowerCase() === 'jsonb') {
          fieldLines.push(`    @JdbcTypeCode(SqlTypes.JSON)`)
          javaTypes.add('JdbcTypeCode')
          javaTypes.add('SqlTypes')
        }
        fieldLines.push(`    @Column(name = "${field.dbColumn}")`)
        fieldLines.push(`    @JsonProperty("${field.dbColumn}")`)
        fieldLines.push(`    private ${jt} ${camelName};`)
        
      } else {
        if (field.dataType.toLowerCase() === 'json' || field.dataType.toLowerCase() === 'jsonb') {
          fieldLines.push(`    @JdbcTypeCode(SqlTypes.JSON)`)
          javaTypes.add('JdbcTypeCode')
          javaTypes.add('SqlTypes')
        }
        fieldLines.push(`    @Column(name = "${field.dbColumn}")`)
        fieldLines.push(`    @JsonProperty("${field.dbColumn}")`)
        fieldLines.push(`    private ${jt} ${camelName};`)
      }
      fieldLines.push(``)
    }
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

  const idClassImport = isComposite ? `import ${groupId}.entities.${model.name}Id;` : ''

  const imports = [
    `import jakarta.persistence.*;`,
    `import lombok.Data;`,
    `import com.fasterxml.jackson.annotation.JsonProperty;`,
    `import com.fasterxml.jackson.annotation.JsonIgnoreProperties;`,
    idClassImport,
    ...getJavaImports(javaTypes),
  ].filter(Boolean).join('\n')

  return `package ${groupId}.entities;

${imports}

@Entity
@Table(name = "${model.dbTable}")
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ${model.name} {

${fieldLines.join('\n')}
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para Relacionamentos Mestre-Detalhe e Ações Customizadas
// ─────────────────────────────────────────────────────────────────────────────

interface IncomingFkDef {
  fkField: string
  fkCamel: string
  fkJavaType: string
}

function getIncomingFks(model: ModelNode, ast: AppAST): IncomingFkDef[] {
  const fks = new Map<string, IncomingFkDef>()
  for (const route of ast.routes) {
    for (const tab of route.relationTabs || []) {
      if (tab.relatedTable === model.dbTable) {
        if (!tab.foreignKey.includes('.')) {
          const fkFieldNode = model.fields.find(f => f.dbColumn === tab.foreignKey)
          const fkJavaType = fkFieldNode ? toJavaType(fkFieldNode.dataType) : 'UUID'
          const fkCamel = toPascalCaseJava(toCamelCase(tab.foreignKey))
          fks.set(tab.foreignKey, { fkField: tab.foreignKey, fkCamel, fkJavaType })
        }
      }
    }
    for (const slot of route.customSlots || []) {
      if (slot.targetModelTable === model.dbTable && slot.foreignKey) {
        if (!slot.foreignKey.includes('.')) {
          const fkFieldNode = model.fields.find(f => f.dbColumn === slot.foreignKey)
          const fkJavaType = fkFieldNode ? toJavaType(fkFieldNode.dataType) : 'UUID'
          const fkCamel = toPascalCaseJava(toCamelCase(slot.foreignKey))
          fks.set(slot.foreignKey, { fkField: slot.foreignKey, fkCamel, fkJavaType })
        }
      }
    }
    for (const btn of route.buttons || []) {
      if (btn.triggerType === 'usecase' && btn.usecaseSelectedFields && btn.usecaseSelectedFields.length > 0) {
        const targetRoute = ast.routes.find(r => r.viewSlug === btn.usecaseSlug)
        if (targetRoute && targetRoute.modelTable === model.dbTable) {
          for (const mapping of btn.usecaseSelectedFields) {
            if (typeof mapping !== 'string' && mapping.target) {
              const fkField = mapping.target
              if (!fkField.includes('.')) {
                const fkFieldNode = model.fields.find(f => f.dbColumn === fkField)
                const fkJavaType = fkFieldNode ? toJavaType(fkFieldNode.dataType) : 'UUID'
                const fkCamel = toPascalCaseJava(toCamelCase(fkField))
                fks.set(fkField, { fkField, fkCamel, fkJavaType })
              }
            }
          }
        }
      }
    }
  }
  return Array.from(fks.values())
}

interface OutgoingSubResourceDef {
  childTable: string
  childModelName: string
  fkField: string
  fkCamel: string
  urlSegment: string
}

function getOutgoingSubResources(route: RouteNode): OutgoingSubResourceDef[] {
  const defs = new Map<string, OutgoingSubResourceDef>()
  for (const tab of route.relationTabs || []) {
    if (!tab.foreignKey.includes('.')) {
      const fkCamel = toPascalCaseJava(toCamelCase(tab.foreignKey))
      const urlSegment = tab.relatedTable.replace(/_/g, '-')
      defs.set(urlSegment, {
        childTable: tab.relatedTable,
        childModelName: tab.relatedModelName,
        fkField: tab.foreignKey,
        fkCamel,
        urlSegment
      })
    }
  }
  for (const slot of route.customSlots || []) {
    if (!slot.foreignKey || !slot.targetModelName) continue
    if (!slot.foreignKey.includes('.')) {
      const fkCamel = toPascalCaseJava(toCamelCase(slot.foreignKey))
      const childTable = slot.targetModelTable ?? ''
      const urlSegment = (childTable || slot.useCaseSlug).replace(/_/g, '-')
      defs.set(urlSegment, {
        childTable,
        childModelName: slot.targetModelName,
        fkField: slot.foreignKey,
        fkCamel,
        urlSegment
      })
    }
  }
  return Array.from(defs.values())
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.6 — Repository.java
// ─────────────────────────────────────────────────────────────────────────────

function generateRepositoryInterface(model: ModelNode, ast: AppAST, groupId: string, route?: RouteNode): string {
  const pkType = getPkJavaType(model)
  const pkFieldPascal = toPascalCaseJava(getPkFieldName(model))
  const incomingFks = getIncomingFks(model, ast)

  const isComposite = hasCompositePk(model)
  const imports = [
    `import ${groupId}.entities.${model.name};`,
    isComposite ? `import ${groupId}.entities.${model.name}Id;` : ``,
    (route && route.gridFields && route.gridFields.length > 0) ? `import ${groupId}.dto.${model.name}ListView;` : ``,
    `import org.springframework.data.domain.Page;`,
    `import org.springframework.data.domain.Pageable;`,
    `import org.springframework.data.jpa.repository.JpaRepository;`,
    `import org.springframework.data.jpa.repository.JpaSpecificationExecutor;`,
    `import org.springframework.stereotype.Repository;`,
    `import java.util.List;`,
    (!isComposite && pkType === 'UUID') ? `import java.util.UUID;` : ``
  ].filter(Boolean).join('\n')

  const extendsClause = `JpaRepository<${model.name}, ${pkType}>, JpaSpecificationExecutor<${model.name}>`

  return `package ${groupId}.repositories;

${imports}

@Repository
public interface ${model.name}Repository extends ${extendsClause} {
    List<${model.name}> findBy${pkFieldPascal}In(List<${pkType}> ids);
    Page<${model.name}> findAll(Pageable pageable);
${(route && route.gridFields && route.gridFields.length > 0) ? `    Page<${model.name}ListView> findAllProjectedBy(Pageable pageable);` : ''}
${incomingFks.map(fk => `    Page<${model.name}> findBy${fk.fkCamel}(${fk.fkJavaType} id, Pageable pageable);`).join('\n')}
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.7 — Service.java
// ─────────────────────────────────────────────────────────────────────────────

function generateServiceClass(model: ModelNode, ast: AppAST, groupId: string, route?: RouteNode): string {
  const pkType = getPkJavaType(model)
  const isComposite = hasCompositePk(model)
  const incomingFks = getIncomingFks(model, ast)

  const imports = [
    `import ${groupId}.entities.${model.name};`,
    isComposite ? `import ${groupId}.entities.${model.name}Id;` : ``,
    `import ${groupId}.repositories.${model.name}Repository;`,
    (route && route.gridFields && route.gridFields.length > 0) ? `import ${groupId}.dto.${model.name}ListView;` : ``,
    `import ${groupId}.specifications.${model.name}Spec;`,
    `import lombok.RequiredArgsConstructor;`,
    `import org.springframework.data.domain.*;`,
    `import org.springframework.stereotype.Service;`,
    `import java.util.*;`,
    (!isComposite && pkType === 'UUID') ? `import java.util.UUID;` : ``
  ].filter(Boolean).join('\n')

  return `package ${groupId}.services;

${imports}

@Service
@RequiredArgsConstructor
public class ${model.name}Service {

    private final ${model.name}Repository repository;

    public Page<${model.name}> findAll(int page, int size, String sort) {
        Sort s = (sort != null && !sort.isEmpty()) ? Sort.by(sort) : Sort.unsorted();
        return repository.findAll(PageRequest.of(page, size, s));
    }

    public Page<${model.name}> search(Map<String, String> params, int page, int size, String sort) {
        Sort s = (sort != null && !sort.isEmpty()) ? Sort.by(sort) : Sort.unsorted();
        Pageable pageable = PageRequest.of(page, size, s);
        return repository.findAll(${model.name}Spec.fromParams(params), pageable);
    }

${(route && route.gridFields && route.gridFields.length > 0) ? `
    public Page<${model.name}ListView> findAllProjected(int page, int size, String sort) {
        Sort s = (sort != null && !sort.isEmpty()) ? Sort.by(sort) : Sort.unsorted();
        return repository.findAllProjectedBy(PageRequest.of(page, size, s));
    }
` : ''}
${incomingFks.map(fk => `
    public Page<${model.name}> findBy${fk.fkCamel}(${fk.fkJavaType} id, int page, int size, String sort) {
        Sort s = (sort != null && !sort.isEmpty()) ? Sort.by(sort) : Sort.unsorted();
        return repository.findBy${fk.fkCamel}(id, PageRequest.of(page, size, s));
    }
`).join('')}
    public Optional<${model.name}> findById(${pkType} id) {
        return repository.findById(id);
    }

    public ${model.name} save(${model.name} entity) {
        return repository.save(entity);
    }

    public void delete(${pkType} id) {
        repository.deleteById(id);
    }

    public Map<String, Object> getAnalyticsSummary() {
        Map<String, Object> summary = new HashMap<>();
        summary.put("totalRecords", repository.count());
        return summary;
    }
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.8 — Controller.java
// ─────────────────────────────────────────────────────────────────────────────

function generateControllerClass(model: ModelNode, ast: AppAST, groupId: string, route?: RouteNode): string {
  const pkType = getPkJavaType(model)
  const isComposite = hasCompositePk(model)
  const mapping = sanitizeTableForMapping(model.dbTable)
  const incomingFks = getIncomingFks(model, ast)
  const outgoingSubResources = route ? getOutgoingSubResources(route) : []

  const extraImports = new Set<string>()
  for (const out of outgoingSubResources) {
    extraImports.add(`import ${groupId}.entities.${out.childModelName};`)
    extraImports.add(`import ${groupId}.services.${out.childModelName}Service;`)
  }

  const imports = [
    `import ${groupId}.entities.${model.name};`,
    isComposite ? `import ${groupId}.entities.${model.name}Id;` : ``,
    `import ${groupId}.services.${model.name}Service;`,
    (route && route.gridFields && route.gridFields.length > 0) ? `import ${groupId}.dto.${model.name}ListView;` : ``,
    ...Array.from(extraImports),
    `import jakarta.validation.Valid;`,
    `import lombok.RequiredArgsConstructor;`,
    `import org.springframework.data.domain.Page;`,
    `import org.springframework.http.ResponseEntity;`,
    `import org.springframework.web.bind.annotation.*;`,
    `import java.util.HashMap;`,
    `import java.util.Map;`,
    (!isComposite && pkType === 'UUID') ? `import java.util.UUID;` : ``
  ].filter(Boolean).join('\n')

  const searchEndpoint = `
    @GetMapping("/search")
    public ResponseEntity<Page<${model.name}>> search(
            @RequestParam Map<String, String> params,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String sort) {
        Map<String, String> filters = new HashMap<>(params);
        filters.remove("page");
        filters.remove("size");
        filters.remove("sort");
        return ResponseEntity.ok(service.search(filters, page, size, sort));
    }
`

  const incomingEndpoints = incomingFks.map(fk => `
    @GetMapping("/by-${fk.fkField.replace(/_/g, '-')}/{id}")
    public ResponseEntity<Page<${model.name}>> findBy${fk.fkCamel}(
            @PathVariable ${fk.fkJavaType} id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String sort) {
        return ResponseEntity.ok(service.findBy${fk.fkCamel}(id, page, size, sort));
    }
`).join('')

  const outgoingEndpoints = outgoingSubResources.map(out => `
    @GetMapping("/{id}/${out.urlSegment}")
    public ResponseEntity<Page<${out.childModelName}>> get${out.childModelName}By${toPascalCaseJava(toCamelCase(model.dbTable))}(
            @PathVariable ${pkType} id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String sort) {
        return ResponseEntity.ok(${toCamelCase(out.childModelName)}Service.findBy${out.fkCamel}(id, page, size, sort));
    }
`).join('')

  return `package ${groupId}.controllers;

${imports}

@RestController
@RequestMapping("/api/${mapping}")
@RequiredArgsConstructor
@CrossOrigin(origins = "\${app.cors.allowed-origins}")
public class ${model.name}Controller {

    private final ${model.name}Service service;
${outgoingSubResources.map(out => `    private final ${out.childModelName}Service ${toCamelCase(out.childModelName)}Service;`).join('\n')}

    @GetMapping
    public ResponseEntity<Page<${model.name}>> list(
            @RequestParam Map<String, String> allParams,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String sort) {
        Map<String, String> filters = new HashMap<>(allParams);
        filters.remove("page");
        filters.remove("size");
        filters.remove("sort");
        if (!filters.isEmpty()) {
            return ResponseEntity.ok(service.search(filters, page, size, sort));
        }
        return ResponseEntity.ok(service.findAll(page, size, sort));
    }

${(route && route.gridFields && route.gridFields.length > 0) ? `
    @GetMapping("/grid")
    public ResponseEntity<Page<${model.name}ListView>> listGrid(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String sort) {
        return ResponseEntity.ok(service.findAllProjected(page, size, sort));
    }
` : ''}

    @GetMapping("/analytics")
    public ResponseEntity<Map<String, Object>> analytics() {
        return ResponseEntity.ok(service.getAnalyticsSummary());
    }

${searchEndpoint}${incomingEndpoints}${outgoingEndpoints}
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
  const dbStackUpper = ast.dbStack.toUpperCase()

  const jwtBadges = ast.jwtEnabled
    ? `\n<a href="#-autenticação--segurança-jwt"><img src="https://img.shields.io/badge/Security-JWT%20Stateless-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT Security" /></a>`
    : ''
  const dockerBadge = ast.generateDockerfile
    ? `\n<a href="#-executar-com-docker"><img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Ready" /></a>`
    : ''
  const migrationBadge = ast.generateMigrations
    ? `\n<a href="#-migrations-de-banco-de-dados"><img src="https://img.shields.io/badge/Migrations-${ast.migrationEngine === 'liquibase' ? 'Liquibase' : 'Flyway'}-CC292B?style=for-the-badge&logo=database&logoColor=white" alt="Migrations" /></a>`
    : ''

  const endpointsRows = ast.models.map(m => {
    const t = sanitizeTableForMapping(m.dbTable)
    return `| **${m.name}** | \`GET\` | \`/api/${t}\` | Listar registros paginados (\`?page=0&size=50&sort=campo\`) |
| **${m.name}** | \`GET\` | \`/api/${t}/{id}\` | Buscar registro por ID |
| **${m.name}** | \`POST\` | \`/api/${t}\` | Criar novo registro com validação Bean Validation |
| **${m.name}** | \`PUT\` | \`/api/${t}/{id}\` | Atualizar registro existente por ID |
| **${m.name}** | \`DELETE\` | \`/api/${t}/{id}\` | Excluir registro por ID |
| **${m.name}** | \`GET\` | \`/api/${t}/search\` | Pesquisa multicritério com filtros dinâmicos |
| **${m.name}** | \`GET\` | \`/api/${t}/analytics\` | Resumo estatístico e contagem de registros |`
  }).join('\n')

  const jwtSection = ast.jwtEnabled ? `
## 🔐 Autenticação & Segurança (JWT)

A API utiliza autenticação **Stateless** com tokens JWT (algoritmo HMAC-SHA256).

### 1. Obter Token de Acesso
\`\`\`bash
curl -X POST http://localhost:${port}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "admin@metabuilder.com", "password": "senhaSegura123"}'
\`\`\`

**Resposta (200 OK):**
\`\`\`json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "admin@metabuilder.com",
  "expiresIn": 86400000
}
\`\`\`

### 2. Consumir Endpoints Protegidos
Envie o token no header \`Authorization\`:
\`\`\`bash
curl -X GET http://localhost:${port}/api/${ast.models[0] ? sanitizeTableForMapping(ast.models[0].dbTable) : 'dados'} \\
  -H "Authorization: Bearer <SEU_TOKEN_AQUI>"
\`\`\`
` : ''

  const migrationsSection = ast.generateMigrations ? `
## 🗄️ Migrations de Banco de Dados (${ast.migrationEngine === 'liquibase' ? 'Liquibase' : 'Flyway'})

${ast.migrationEngine === 'liquibase'
  ? `O versionamento de banco é automatizado com **Liquibase**:
- Changelog mestre: \`src/main/resources/db/changelog/db.changelog-master.yaml\`
- As tabelas e constraints são aplicadas automaticamente no boot do Spring Boot.`
  : `O versionamento de banco é automatizado com **Flyway**:
- Scripts de migração: \`src/main/resources/db/migration/V1__init.sql\`
- Para novas alterações de schema, crie arquivos seguindo o padrão \`V2__descricao.sql\`.
- As migrações executam automaticamente na inicialização da aplicação.`
}
` : ''

  const dockerSection = ast.generateDockerfile ? `
## 🐳 Executar com Docker

### 1. Construir a Imagem Multi-Stage
\`\`\`bash
docker build -t ${ast.projectSlug}-backend:latest .
\`\`\`

### 2. Executar o Container
\`\`\`bash
docker run -d \\
  --name ${ast.projectSlug}-backend \\
  -p ${port}:${port} \\
  ${ast.projectSlug}-backend:latest
\`\`\`
` : ''

  const testsSection = (ast.generateServiceTests || ast.generateControllerTests) ? `
## 🧪 Testes Automatizados (JUnit 5 + Mockito)

Execute a suíte de testes com o Maven Wrapper:
\`\`\`bash
# Executar todos os testes
./mvnw test

# Executar apenas testes de uma classe específica
./mvnw test -Dtest=${ast.models[0] ? ast.models[0].name : 'App'}ServiceTest
\`\`\`
` : ''

  return `<div align="center">

# 🚀 ${ast.projectName} — Backend API (Spring Boot)

<p align="center">
  <img src="https://img.shields.io/badge/Java-${javaVersion}%20LTS-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java ${javaVersion}" />
  <img src="https://img.shields.io/badge/Spring%20Boot-3.3.0-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot 3" />
  <img src="https://img.shields.io/badge/Database-${dbStackUpper}-336791?style=for-the-badge&logo=database&logoColor=white" alt="Database ${dbStackUpper}" />
  <img src="https://img.shields.io/badge/Swagger-OpenAPI%203.0-85EA2D?style=for-the-badge&logo=swagger&logoColor=black" alt="Swagger OpenAPI" />${jwtBadges}${migrationBadge}${dockerBadge}
</p>

**API REST empresarial gerada com arquitetura limpa, alta performance e type-safety.**

</div>

---

## 📋 Pré-requisitos

| Ferramenta | Versão Mínima | Descrição / Download |
|---|---|---|
| **JDK** | Java ${javaVersion} (LTS) | [Eclipse Adoptium Temurin](https://adoptium.net/) |
| **Maven** | 3.9+ | Opcional (Maven Wrapper \`./mvnw\` já incluído) |
| **Banco de Dados** | ${dbStackUpper} | Instância local, em nuvem ou via Docker |

---

## ⚙️ Configuração do Ambiente

1. Crie o arquivo de configuração baseado no exemplo:
\`\`\`bash
cp .env.example .env
\`\`\`

2. Verifique as credenciais no arquivo \`src/main/resources/application.properties\`:
\`\`\`properties
spring.datasource.url=jdbc:... # configure a URL JDBC correta
spring.datasource.username=seu_usuario
spring.datasource.password=sua_senha
\`\`\`

---

## 🚀 Como Executar

### Opção 1: Via Maven Wrapper (Recomendado)
\`\`\`bash
# No Linux / macOS:
./mvnw spring-boot:run

# No Windows PowerShell:
.\\mvnw.cmd spring-boot:run
\`\`\`

### Opção 2: Compilar e Rodar o JAR
\`\`\`bash
./mvnw clean package -DskipTests
java -jar target/*.jar
\`\`\`

A API estará disponível em: **\`http://localhost:${port}\`**
Documentação interativa Swagger UI: **\`http://localhost:${port}/swagger-ui.html\`**
Especificação OpenAPI (JSON): **\`http://localhost:${port}/api-docs\`**

---
${testsSection}${migrationsSection}${jwtSection}${dockerSection}
## 📚 Endpoints da API

Abaixo estão todos os endpoints REST gerados para os modelos de dados:

| Modelo | Método | Rota | Descrição |
|---|---|---|---|
${endpointsRows}

---

## 🏛️ Arquitetura do Projeto

\`\`\`
backend/
├── src/
│   ├── main/
│   │   ├── java/${groupIdToPath(ast.javaGroupId ?? 'com.app')}/
│   │   │   ├── Application.java          # Entry point Spring Boot
│   │   │   ├── config/                   # Configurações (CORS, Swagger${ast.jwtEnabled ? ', Security' : ''})
${ast.jwtEnabled ? '│   │   │   ├── security/                 # Utilitários JWT & Filter de Autenticação\n' : ''}│   │   │   ├── entities/                 # Entidades JPA (@Entity)
│   │   │   ├── repositories/             # Interfaces Spring Data JPA
│   │   │   ├── services/                 # Camada de Negócio (@Service)
│   │   │   ├── controllers/              # Endpoints REST (@RestController)
│   │   │   ├── dto/                      # Projeções e DTOs de listagem
│   │   │   └── specifications/           # Especificações JPA de busca dinâmica
│   │   └── resources/
│   │       ├── application.properties    # Configurações do servidor e banco
${ast.generateMigrations ? (ast.migrationEngine === 'liquibase' ? '│   │       └── db/changelog/             # Migrations Liquibase\n' : '│   │       └── db/migration/             # Migrations Flyway SQL\n') : ''}│   └── test/                             # Testes automatizados (JUnit 5 + Mockito)
├── pom.xml                               # Dependências Maven
${ast.generateDockerfile ? '├── Dockerfile                            # Docker multi-stage build\n' : ''}${ast.generateEnvExample ? '└── .env.example                          # Exemplo de variáveis de ambiente\n' : ''}\`\`\`

---

## 🛠️ Resolução de Problemas (Troubleshooting)

| Sintoma | Possível Causa | Como Resolver |
|---|---|---|
| \`Port ${port} is already in use\` | A porta configurada já está em uso por outro processo | Altere \`server.port\` no \`application.properties\` ou encerre o processo conflitante |
| \`Connection to localhost refused\` | O banco de dados ${dbStackUpper} não está ativo | Inicie o serviço do banco de dados ou use o \`docker-compose up db -d\` |
| \`401 Unauthorized\` | Token JWT ausente ou inválido | Faça login em \`POST /api/auth/login\` e adicione o header \`Authorization: Bearer <token>\` |
| \`CORS header missing\` | Requisições vindas de portas não liberadas | Ajuste \`app.cors.allowed-origins\` em \`application.properties\` |

${javaVersion === 21 ? `---

## ⚡ Virtual Threads (Project Loom — Java 21)
Este projeto vem pré-configurado com Virtual Threads do Java 21 (\`spring.threads.virtual.enabled=true\`). Isto permite throughput extremamente elevado sem o consumo de threads do sistema operacional.
` : ''}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.12 — Specification.java (Pesquisa Dinâmica)
// ─────────────────────────────────────────────────────────────────────────────

function generateSpecificationClass(model: ModelNode, ast: AppAST, groupId: string, route?: RouteNode): string {
  const predicates: string[] = []
  const imports = new Set<string>([
    'import jakarta.persistence.criteria.*;',
    'import org.springframework.data.jpa.domain.Specification;',
    'import java.util.ArrayList;',
    'import java.util.List;',
    'import java.util.Map;',
    `import ${groupId}.entities.${model.name};`
  ])

  // Usa filterFields da rota se configurados, caso contrário utiliza todos os campos escalares do modelo
  const filterFields = (route?.filterFields && route.filterFields.filter(f => !f.dbColumn.includes('.')).length > 0)
    ? route.filterFields.filter(f => !f.dbColumn.includes('.'))
    : model.fields.filter(f => !f.dbColumn.includes('.'))

  for (const field of filterFields) {
    const javaProp = toCamelCase(field.dbColumn)
    const paramKey = field.dbColumn
    const dbType = canonicalDbType(field.dataType)

    let predicateLogic = ''
    if (dbType === 'varchar') {
      predicateLogic = `
            String val_${javaProp} = params.get("${paramKey}") != null ? params.get("${paramKey}") : params.get("${javaProp}");
            if (val_${javaProp} != null && !val_${javaProp}.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("${javaProp}")),
                    "%" + val_${javaProp}.toLowerCase() + "%"));
            }`
    } else if (dbType === 'date' || dbType === 'timestamp') {
      const cls = dbType === 'date' ? 'LocalDate' : 'LocalDateTime'
      if (dbType === 'date') imports.add('import java.time.LocalDate;')
      else imports.add('import java.time.LocalDateTime;')

      predicateLogic = `
            String start_${javaProp} = params.get("${paramKey}_start") != null ? params.get("${paramKey}_start") : params.get("${javaProp}_start");
            if (start_${javaProp} != null && !start_${javaProp}.isBlank()) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("${javaProp}"),
                    ${cls}.parse(start_${javaProp})));
            }
            String end_${javaProp} = params.get("${paramKey}_end") != null ? params.get("${paramKey}_end") : params.get("${javaProp}_end");
            if (end_${javaProp} != null && !end_${javaProp}.isBlank()) {
                predicates.add(cb.lessThanOrEqualTo(root.get("${javaProp}"),
                    ${cls}.parse(end_${javaProp})));
            }`
    } else if (dbType === 'uuid') {
      imports.add('import java.util.UUID;')
      predicateLogic = `
            String val_${javaProp} = params.get("${paramKey}") != null ? params.get("${paramKey}") : params.get("${javaProp}");
            if (val_${javaProp} != null && !val_${javaProp}.isBlank()) {
                try {
                    predicates.add(cb.equal(root.get("${javaProp}"), UUID.fromString(val_${javaProp})));
                } catch (Exception ignored) {}
            }`
    } else if (dbType === 'integer') {
      predicateLogic = `
            String val_${javaProp} = params.get("${paramKey}") != null ? params.get("${paramKey}") : params.get("${javaProp}");
            if (val_${javaProp} != null && !val_${javaProp}.isBlank()) {
                try {
                    predicates.add(cb.equal(root.get("${javaProp}"), Integer.parseInt(val_${javaProp})));
                } catch (Exception ignored) {}
            }`
    } else if (dbType === 'numeric') {
      imports.add('import java.math.BigDecimal;')
      predicateLogic = `
            String val_${javaProp} = params.get("${paramKey}") != null ? params.get("${paramKey}") : params.get("${javaProp}");
            if (val_${javaProp} != null && !val_${javaProp}.isBlank()) {
                try {
                    predicates.add(cb.equal(root.get("${javaProp}"), new BigDecimal(val_${javaProp})));
                } catch (Exception ignored) {}
            }`
    } else if (dbType === 'boolean') {
      predicateLogic = `
            String val_${javaProp} = params.get("${paramKey}") != null ? params.get("${paramKey}") : params.get("${javaProp}");
            if (val_${javaProp} != null && !val_${javaProp}.isBlank()) {
                predicates.add(cb.equal(root.get("${javaProp}"), Boolean.parseBoolean(val_${javaProp})));
            }`
    }

    if (predicateLogic) predicates.push(predicateLogic)
  }

  return `package ${groupId}.specifications;

${Array.from(imports).sort().join('\n')}

public class ${model.name}Spec {

    public static Specification<${model.name}> fromParams(Map<String, String> params) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
${predicates.join('\n')}
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.13 — DTO de Projeção para o Grid (ListView)
// ─────────────────────────────────────────────────────────────────────────────

function generateProjectionInterface(model: ModelNode, ast: AppAST, groupId: string, route: RouteNode): string {
  const fields = route.gridFields || []
  let hasPk = false

  const getters = fields.map(f => {
    if (f.isPrimaryKey) hasPk = true
    const dbType = toJavaType(f.dataType)
    const camel = toPascalCaseJava(toCamelCase(f.dbColumn))
    return `    ${dbType} get${camel}();`
  })

  // Garantir que a chave primária sempre venha na projeção para permitir seleção/edição
  if (!hasPk) {
    const pkType = getPkJavaType(model)
    const pkPascal = toPascalCaseJava(getPkFieldName(model))
    getters.unshift(`    ${pkType} get${pkPascal}();`)
  }

  const javaTypes = new Set<string>()
  fields.forEach(f => {
    const jt = toJavaType(f.dataType)
    if (!['String', 'Integer', 'Boolean', 'Double', 'Long'].includes(jt)) {
      javaTypes.add(jt)
    }
  })
  if (!hasPk && getPkJavaType(model) === 'UUID') javaTypes.add('UUID')

  const imports = Array.from(getJavaImports(javaTypes)).join('\n')

  return `package ${groupId}.dto;

${imports}

public interface ${model.name}ListView {
${getters.join('\n')}
}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.14 — SQL Migrations (Flyway & Liquibase)
// ─────────────────────────────────────────────────────────────────────────────

function toSqlMigrationTypeForDb(dataType: string, dbStack: DbType): string {
  const dt = canonicalDbType(dataType)
  switch (dt) {
    case 'uuid':
      if (dbStack === 'postgres' || dbStack === 'supabase') return 'UUID'
      if (dbStack === 'mysql') return 'CHAR(36)'
      if (dbStack === 'sqlserver') return 'UNIQUEIDENTIFIER'
      if (dbStack === 'oracle') return 'VARCHAR2(36)'
      return 'VARCHAR(36)'
    case 'boolean':
      if (dbStack === 'postgres' || dbStack === 'supabase') return 'BOOLEAN'
      if (dbStack === 'mysql') return 'TINYINT(1)'
      if (dbStack === 'sqlserver') return 'BIT'
      if (dbStack === 'oracle') return 'NUMBER(1)'
      return 'BOOLEAN'
    case 'integer':
      if (dbStack === 'oracle') return 'NUMBER(10)'
      return 'INT'
    case 'numeric':
      if (dbStack === 'oracle') return 'NUMBER(15,2)'
      if (dbStack === 'mysql' || dbStack === 'sqlserver') return 'DECIMAL(15,2)'
      return 'NUMERIC(15,2)'
    case 'date':
      return 'DATE'
    case 'timestamp':
      if (dbStack === 'mysql') return 'DATETIME'
      if (dbStack === 'sqlserver') return 'DATETIME2'
      return 'TIMESTAMP'
    default:
      if (dataType.toLowerCase() === 'text' || dataType.toLowerCase() === 'clob') {
        if (dbStack === 'postgres' || dbStack === 'supabase') return 'TEXT'
        if (dbStack === 'mysql') return 'LONGTEXT'
        if (dbStack === 'sqlserver') return 'NVARCHAR(MAX)'
        if (dbStack === 'oracle') return 'CLOB'
        return 'TEXT'
      }
      if (dbStack === 'oracle') return 'VARCHAR2(255)'
      if (dbStack === 'sqlserver') return 'NVARCHAR(255)'
      return 'VARCHAR(255)'
  }
}

function generateMigrationFiles(ast: AppAST, files: Map<string, string>): void {
  if (ast.migrationEngine === 'liquibase') {
    files.set('backend/src/main/resources/db/changelog/db.changelog-master.yaml', generateLiquibaseChangelog(ast))
  } else {
    files.set('backend/src/main/resources/db/migration/V1__init.sql', generateFlywayMigration(ast))
  }
}

function generateFlywayMigration(ast: AppAST): string {
  const sqlBlocks: string[] = [
    `-- =========================================================================`,
    `-- V1__init.sql — MetaBuilder Pro Auto-Generated Migration`,
    `-- Project: ${ast.projectName}`,
    `-- Database: ${ast.dbStack.toUpperCase()}`,
    `-- =========================================================================\n`,
  ]

  for (const model of ast.models) {
    const tableName = sanitizeTableForMapping(model.dbTable)
    const realFields = model.fields.filter(f => !f.dbColumn.includes('.'))
    const pkFields = realFields.filter(f => f.isPrimary)
    const isComposite = pkFields.length > 1

    const fieldDefs = realFields.map(f => {
      const sqlType = toSqlMigrationTypeForDb(f.dataType, ast.dbStack)
      const pkModifier = (!isComposite && f.isPrimary) ? ' PRIMARY KEY' : ''
      const nullModifier = (!f.isPrimary && f.isRequired) ? ' NOT NULL' : ''
      return `    ${f.dbColumn} ${sqlType}${pkModifier}${nullModifier}`
    })

    if (isComposite) {
      const pkCols = pkFields.map(f => f.dbColumn).join(', ')
      fieldDefs.push(`    CONSTRAINT pk_${tableName} PRIMARY KEY (${pkCols})`)
    }

    const ifNotExists = (ast.dbStack === 'oracle') ? '' : 'IF NOT EXISTS '
    sqlBlocks.push(
      `-- Tabela: ${model.name} (${tableName})\n` +
      `CREATE TABLE ${ifNotExists}${tableName} (\n` +
      fieldDefs.join(',\n') +
      `\n);\n`
    )
  }

  return sqlBlocks.join('\n')
}

function generateLiquibaseChangelog(ast: AppAST): string {
  const tablesYaml = ast.models.map(m => {
    const tableName = sanitizeTableForMapping(m.dbTable)
    const realFields = m.fields.filter(f => !f.dbColumn.includes('.'))
    const colsYaml = realFields.map(f => {
      const sqlType = toSqlMigrationTypeForDb(f.dataType, ast.dbStack)
      const isPk = f.isPrimary
      const isNullable = !f.isPrimary && !f.isRequired
      return `                - column:
                    name: ${f.dbColumn}
                    type: ${sqlType}
                    constraints:
                      primaryKey: ${isPk}
                      nullable: ${isNullable}`
    }).join('\n')

    return `        - createTable:
            tableName: ${tableName}
            columns:
${colsYaml}`
  }).join('\n')

  return `databaseChangeLog:
  - changeSet:
      id: 1-init-schema
      author: metabuilder-pro
      changes:
${tablesYaml}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.15 — Segurança JWT (SecurityConfig, JwtUtil, JwtFilter, AuthController)
// ─────────────────────────────────────────────────────────────────────────────

function generateJwtFiles(ast: AppAST, files: Map<string, string>, basePkg: string, groupId: string): void {
  const encoderSnippet = ast.passwordHashAlgorithm === 'sha256'
    ? 'return new org.springframework.security.crypto.password.MessageDigestPasswordEncoder("SHA-256");'
    : 'return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();'

  // 1. SecurityConfig.java
  files.set(`${basePkg}/config/SecurityConfig.java`, `package ${groupId}.config;

import ${groupId}.security.JwtFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    public SecurityConfig(JwtFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> {})
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html", "/api-docs/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        ${encoderSnippet}
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }
}
`)

  // 2. JwtUtil.java
  files.set(`${basePkg}/security/JwtUtil.java`, `package ${groupId}.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    @Value("\${jwt.secret:minha-chave-secreta-256-bits-super-segura-e-longa-32bytes}")
    private String secret;

    @Value("\${jwt.expiration-ms:86400000}")
    private long expirationMs;

    private Key getSigningKey() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(keyBytes, 0, padded, 0, keyBytes.length);
            keyBytes = padded;
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(String subject) {
        return Jwts.builder()
                .setSubject(subject)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String extractSubject(String token) {
        return extractClaims(token).getSubject();
    }

    public Claims extractClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public boolean validateToken(String token) {
        try {
            extractClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
`)

  // 3. JwtFilter.java
  files.set(`${basePkg}/security/JwtFilter.java`, `package ${groupId}.security;

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
                String subject = jwtUtil.extractSubject(token);
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                subject,
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
`)

  // 4. AuthController.java
  files.set(`${basePkg}/controllers/AuthController.java`, `package ${groupId}.controllers;

import ${groupId}.security.JwtUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Autenticação", description = "Endpoints de login e verificação JWT")
public class AuthController {

    private final JwtUtil jwtUtil;

    public AuthController(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    public record LoginRequest(String email, String password) {}

    @PostMapping("/login")
    @Operation(summary = "Autenticar usuário", description = "Valida credenciais e gera token JWT")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        // TODO: Integrar com a tabela de usuários do banco para validação de senha
        if (request.email() == null || request.password() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email e senha são obrigatórios"));
        }

        String token = jwtUtil.generateToken(request.email());
        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("email", request.email());
        response.put("expiresIn", 86400000L);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    @Operation(summary = "Verificar autenticação", description = "Retorna os dados do usuário autenticado")
    public ResponseEntity<?> me(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("authenticated", false));
        }
        return ResponseEntity.ok(Map.of(
                "authenticated", true,
                "principal", authentication.getPrincipal(),
                "roles", authentication.getAuthorities()
        ));
    }
}
`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.16 — Testes Automatizados (Service & Controller)
// ─────────────────────────────────────────────────────────────────────────────

function generateTestFiles(ast: AppAST, files: Map<string, string>, groupId: string): void {
  const groupPath = groupIdToPath(groupId)
  const testBasePkg = `backend/src/test/java/${groupPath}`

  const routeMap = new Map<string, RouteNode>()
  for (const route of ast.routes) {
    routeMap.set(route.modelName, route)
    routeMap.set(route.modelTable, route)
  }

  for (const model of ast.models) {
    const route = routeMap.get(model.name) ?? routeMap.get(model.dbTable)
    const mapping = sanitizeTableForMapping(model.dbTable)
    const outgoingSubResources = route ? getOutgoingSubResources(route) : []

    // 1. Service Test
    if (ast.generateServiceTests) {
      files.set(`${testBasePkg}/services/${model.name}ServiceTest.java`, `package ${groupId}.services;

import ${groupId}.entities.${model.name};
import ${groupId}.repositories.${model.name}Repository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Testes Unitários - ${model.name}Service")
class ${model.name}ServiceTest {

    @Mock
    private ${model.name}Repository repository;

    @InjectMocks
    private ${model.name}Service service;

    @Test
    @DisplayName("Deve buscar todos os registros paginados")
    void deveBuscarTodosComPaginacao() {
        Page<${model.name}> mockPage = new PageImpl<>(List.of(new ${model.name}()));
        when(repository.findAll(any(Pageable.class))).thenReturn(mockPage);

        Page<${model.name}> result = service.findAll(0, 10, null);

        assertThat(result).isNotNull();
        assertThat(result.getContent()).hasSize(1);
        verify(repository, times(1)).findAll(any(Pageable.class));
    }

    @Test
    @DisplayName("Deve salvar uma entidade com sucesso")
    void deveSalvarEntidade() {
        ${model.name} entity = new ${model.name}();
        when(repository.save(any(${model.name}.class))).thenReturn(entity);

        ${model.name} saved = service.save(entity);

        assertThat(saved).isNotNull();
        verify(repository, times(1)).save(entity);
    }

    @Test
    @DisplayName("Deve excluir entidade por ID")
    void deveDeletarPorId() {
        doNothing().when(repository).deleteById(any());

        service.delete(null);

        verify(repository, times(1)).deleteById(any());
    }
}
`)
    }

    // 2. Controller Test
    if (ast.generateControllerTests) {
      const mockBeansChildServices = outgoingSubResources.map(out =>
        `    @MockBean\n    private ${groupId}.services.${out.childModelName}Service ${toCamelCase(out.childModelName)}Service;`
      ).join('\n')

      files.set(`${testBasePkg}/controllers/${model.name}ControllerTest.java`, `package ${groupId}.controllers;

import ${groupId}.entities.${model.name};
import ${groupId}.services.${model.name}Service;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(${model.name}Controller.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("Testes de Integração MVC - ${model.name}Controller")
class ${model.name}ControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ${model.name}Service service;
${mockBeansChildServices ? '\n' + mockBeansChildServices : ''}

    @Test
    @DisplayName("GET /api/${mapping} - Deve retornar lista paginada")
    void deveRetornarListaPaginada() throws Exception {
        when(service.findAll(anyInt(), anyInt(), any())).thenReturn(new PageImpl<>(List.of(new ${model.name}())));

        mockMvc.perform(get("/api/${mapping}")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /api/${mapping} - Deve criar registro com status 201")
    void deveCriarEntidade() throws Exception {
        ${model.name} entity = new ${model.name}();
        when(service.save(any(${model.name}.class))).thenReturn(entity);

        mockMvc.perform(post("/api/${mapping}")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isCreated());
    }
}
`)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.17 — Dockerfile (Multi-stage Eclipse Temurin)
// ─────────────────────────────────────────────────────────────────────────────

function generateBackendDockerfile(ast: AppAST): string {
  const javaVersion = ast.javaVersion ?? 21
  const port = ast.javaPort ?? 8080

  return `# =========================================================================
# Multi-Stage Dockerfile - Eclipse Temurin (JDK + JRE Minimal Alpine)
# Generated by MetaBuilder Pro
# =========================================================================

# ── Stage 1: Build & Dependencies Cache ──
FROM eclipse-temurin:${javaVersion}-jdk-alpine AS builder
WORKDIR /app

# Copia configurações Maven e wrapper
COPY pom.xml mvnw ./
COPY .mvn .mvn
RUN chmod +x ./mvnw

# Resolve dependências em cache
RUN ./mvnw dependency:go-offline -B

# Copia código-fonte e compila pacote sem testes unitários
COPY src ./src
RUN ./mvnw clean package -DskipTests -B

# ── Stage 2: Runtime Image (Lightweight JRE) ──
FROM eclipse-temurin:${javaVersion}-jre-alpine
WORKDIR /app

# Usuário não-root por boas práticas de segurança
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copia o artefato compilado do builder
COPY --from=builder /app/target/*.jar app.jar

# Porta do servidor Spring Boot
EXPOSE ${port}

# Tuning para containers Docker e suporte a Virtual Threads
ENV JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Dfile.encoding=UTF-8"

ENTRYPOINT ["java", "-jar", "app.jar"]
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.18 — docker-compose.yml (Backend + Database)
// ─────────────────────────────────────────────────────────────────────────────

function generateDockerCompose(ast: AppAST): string {
  const slug = ast.projectSlug || 'app'
  const port = ast.javaPort ?? 8080

  let dbImage = 'postgres:16-alpine'
  let dbHostPort = 5432
  let dbContainerPort = 5432
  let dbVolumePath = '/var/lib/postgresql/data'
  let dbEnvLines = ''
  let healthCheckLines = ''
  let composeJdbcUrl = `jdbc:postgresql://db:5432/${slug}_db`
  let composeUser = 'postgres'
  let composePass = 'postgres'

  switch (ast.dbStack) {
    case 'postgres':
    case 'supabase':
      dbImage = 'postgres:16-alpine'
      dbHostPort = 5432
      dbContainerPort = 5432
      dbVolumePath = '/var/lib/postgresql/data'
      dbEnvLines = [
        `      POSTGRES_DB: ${slug}_db`,
        `      POSTGRES_USER: postgres`,
        `      POSTGRES_PASSWORD: postgres`,
      ].join('\n')
      healthCheckLines = [
        `      test: ["CMD-SHELL", "pg_isready -U postgres -d ${slug}_db"]`,
        `      interval: 5s`,
        `      timeout: 5s`,
        `      retries: 5`,
      ].join('\n')
      composeJdbcUrl = `jdbc:postgresql://db:5432/${slug}_db`
      composeUser = 'postgres'
      composePass = 'postgres'
      break

    case 'mysql':
      dbImage = 'mysql:8-debian'
      dbHostPort = 3306
      dbContainerPort = 3306
      dbVolumePath = '/var/lib/mysql'
      dbEnvLines = [
        `      MYSQL_DATABASE: ${slug}_db`,
        `      MYSQL_ROOT_PASSWORD: root`,
      ].join('\n')
      healthCheckLines = [
        `      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]`,
        `      interval: 5s`,
        `      timeout: 5s`,
        `      retries: 5`,
      ].join('\n')
      composeJdbcUrl = `jdbc:mysql://db:3306/${slug}_db?useSSL=false&allowPublicKeyRetrieval=true`
      composeUser = 'root'
      composePass = 'root'
      break

    case 'sqlserver':
      dbImage = 'mcr.microsoft.com/mssql/server:2022-latest'
      dbHostPort = 1433
      dbContainerPort = 1433
      dbVolumePath = '/var/opt/mssql'
      dbEnvLines = [
        `      ACCEPT_EULA: "Y"`,
        `      MSSQL_SA_PASSWORD: "Password123!"`,
      ].join('\n')
      healthCheckLines = [
        `      test: ["CMD-SHELL", "/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P 'Password123!' -Q 'SELECT 1' || exit 1"]`,
        `      interval: 10s`,
        `      timeout: 5s`,
        `      retries: 5`,
      ].join('\n')
      composeJdbcUrl = `jdbc:sqlserver://db:1433;databaseName=master;trustServerCertificate=true`
      composeUser = 'sa'
      composePass = 'Password123!'
      break

    case 'oracle':
      dbImage = 'gvenzl/oracle-free:latest'
      dbHostPort = 1521
      dbContainerPort = 1521
      dbVolumePath = '/opt/oracle/oradata'
      dbEnvLines = [
        `      APP_USER: app`,
        `      APP_USER_PASSWORD: Password123!`,
      ].join('\n')
      healthCheckLines = [
        `      test: ["CMD-SHELL", "healthcheck.sh"]`,
        `      interval: 10s`,
        `      timeout: 5s`,
        `      retries: 5`,
      ].join('\n')
      composeJdbcUrl = `jdbc:oracle:thin:@//db:1521/FREEPDB1`
      composeUser = 'app'
      composePass = 'Password123!'
      break
  }

  const jwtEnv = ast.jwtEnabled
    ? `\n      - JWT_SECRET=\${JWT_SECRET:-minha-chave-secreta-256-bits-super-segura-e-longa-32bytes}`
    : ''

  return `# =========================================================================
# docker-compose.yml — Stack Completa (App + Banco de Dados)
# Generated by MetaBuilder Pro
# =========================================================================

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ${slug}-backend
    restart: unless-stopped
    ports:
      - "${port}:${port}"
    environment:
      - SPRING_PROFILES_ACTIVE=docker
      - SERVER_PORT=${port}
      - SPRING_DATASOURCE_URL=${composeJdbcUrl}
      - SPRING_DATASOURCE_USERNAME=${composeUser}
      - SPRING_DATASOURCE_PASSWORD=${composePass}${jwtEnv}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - ${slug}-network

  db:
    image: ${dbImage}
    container_name: ${slug}-db
    restart: unless-stopped
    ports:
      - "${dbHostPort}:${dbContainerPort}"
    environment:
${dbEnvLines}
    healthcheck:
${healthCheckLines}
    volumes:
      - db_data:${dbVolumePath}
    networks:
      - ${slug}-network

volumes:
  db_data:

networks:
  ${slug}-network:
    driver: bridge
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.19 — .env.example
// ─────────────────────────────────────────────────────────────────────────────

function generateEnvExample(ast: AppAST): string {
  const port = ast.javaPort ?? 8080
  const slug = ast.projectSlug || 'app'

  let defaultUrl = 'jdbc:postgresql://localhost:5432/nome_do_banco'
  let defaultUser = 'postgres'
  let defaultPass = 'senha_secreta'

  switch (ast.dbStack) {
    case 'postgres':
    case 'supabase':
      defaultUrl = `jdbc:postgresql://localhost:5432/${slug}_db`
      defaultUser = 'postgres'
      defaultPass = 'postgres'
      break
    case 'mysql':
      defaultUrl = `jdbc:mysql://localhost:3306/${slug}_db?useSSL=false&allowPublicKeyRetrieval=true`
      defaultUser = 'root'
      defaultPass = 'root'
      break
    case 'sqlserver':
      defaultUrl = `jdbc:sqlserver://localhost:1433;databaseName=${slug}_db;trustServerCertificate=true`
      defaultUser = 'sa'
      defaultPass = 'Password123!'
      break
    case 'oracle':
      defaultUrl = `jdbc:oracle:thin:@//localhost:1521/FREEPDB1`
      defaultUser = 'app'
      defaultPass = 'Password123!'
      break
  }

  const jwtLines = ast.jwtEnabled ? `
# ── Segurança JWT ──
# Chave de assinatura HMAC-SHA256 (mínimo de 256 bits / 32 caracteres)
# Recomendado gerar com: openssl rand -hex 32
JWT_SECRET=minha-chave-secreta-256-bits-super-segura-e-longa-32bytes

# Tempo de vida do token em milissegundos (86400000 ms = 24 horas)
JWT_EXPIRATION_MS=86400000
` : ''

  return `# =========================================================================
# .env.example — Variáveis de Ambiente do Backend Spring Boot
# Copie este arquivo para .env ou configure no seu gerenciador de segredos
# =========================================================================

# ── Servidor Spring Boot ──
SERVER_PORT=${port}
SPRING_PROFILES_ACTIVE=dev

# ── Banco de Dados (${ast.dbStack.toUpperCase()}) ──
SPRING_DATASOURCE_URL=${defaultUrl}
SPRING_DATASOURCE_USERNAME=${defaultUser}
SPRING_DATASOURCE_PASSWORD=${defaultPass}
${jwtLines}
# ── CORS ──
APP_CORS_ALLOWED_ORIGINS=http://localhost:3000
`
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.20 — README.md Raiz do Projeto (Full-Stack)
// ─────────────────────────────────────────────────────────────────────────────

export function generateRootReadme(ast: AppAST): string {
  const port = ast.javaPort ?? 8080
  const slug = ast.projectSlug || 'app'
  const dbStackUpper = ast.dbStack.toUpperCase()

  const modelsRows = ast.models.map(m => {
    const fieldsCount = m.fields.filter(f => !f.dbColumn.includes('.')).length
    return `| **${m.name}** | \`${sanitizeTableForMapping(m.dbTable)}\` | ${fieldsCount} campos | [Swagger API](http://localhost:${port}/swagger-ui.html#/${m.name}) |`
  }).join('\n')

  return `<div align="center">

# 🌟 ${ast.projectName} — Projeto Completo Full-Stack

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Next.js%2014-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/Backend-Spring%20Boot%203-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot 3" />
  <img src="https://img.shields.io/badge/Java-21%20LTS-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java 21" />
  <img src="https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Database-${dbStackUpper}-336791?style=for-the-badge&logo=database&logoColor=white" alt="Database" />
</p>

**Projeto completo gerado pelo MetaBuilder Pro com separação limpa entre Frontend (Next.js) e Backend (Spring Boot).**

</div>

---

## 🌐 Visão Geral dos Serviços

| Serviço | Diretório | Tecnologia | URL Padrão |
|---|---|---|---|
| **Frontend Web** | \`frontend/\` | Next.js 14 + React + TypeScript | [http://localhost:3000](http://localhost:3000) |
| **Backend REST** | \`backend/\` | Spring Boot 3 + Java 21 | [http://localhost:${port}](http://localhost:${port}) |
| **Documentação API** | \`backend/\` | Swagger / OpenAPI 3.0 | [http://localhost:${port}/swagger-ui.html](http://localhost:${port}/swagger-ui.html) |
| **Banco de Dados** | — | ${dbStackUpper} | Configurado no \`backend/\` |

---

## 📁 Estrutura do Repositório

\`\`\`
${slug}/
├── frontend/                     # Aplicação Next.js 14 (App Router)
│   ├── src/app/                  # Páginas, telas de listagem, formulários e kanban
│   ├── src/components/           # Componentes UI reutilizáveis (shadcn/ui style)
│   ├── src/lib/api-client.ts     # Cliente HTTP type-safe para a API Spring Boot
│   ├── package.json              # Dependências do frontend
│   └── README.md                 # Documentação detalhada do frontend
│
├── backend/                      # API REST Spring Boot 3
│   ├── src/main/java/            # Código Java (Entities, Repositories, Services, Controllers)
│   ├── src/main/resources/       # application.properties, migrations SQL
│   ├── src/test/java/            # Testes automatizados (JUnit 5 + Mockito)
│   ├── pom.xml                   # Dependências Maven
│   ├── Dockerfile                # Imagem container multi-stage
│   └── README.md                 # Documentação detalhada do backend
│
${ast.generateDockerCompose ? '├── docker-compose.yml            # Orquestração do Backend + Banco de Dados\n' : ''}└── README.md                     # Este arquivo (Visão Geral do Projeto)
\`\`\`

---

## 🚀 Inicialização Rápida (Quick Start)

${ast.generateDockerCompose ? `### Opção A: Usando Docker Compose (Mais Fácil)
Suba o backend e o banco de dados com um único comando:
\`\`\`bash
# Na raiz do projeto:
docker-compose up --build
\`\`\`

Em seguida, inicie o frontend:
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`
` : ''}
### Opção B: Execução Local Passo a Passo

#### 1. Iniciar o Backend Spring Boot
\`\`\`bash
cd backend
# No Linux/macOS:
./mvnw spring-boot:run
# No Windows PowerShell:
.\\mvnw.cmd spring-boot:run
\`\`\`
> A API estará operando em: **\`http://localhost:${port}\`**

#### 2. Iniciar o Frontend Next.js
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`
> O sistema estará acessível em: **\`http://localhost:3000\`**

---

## 📊 Modelos de Dados Gerados

O MetaBuilder Pro gerou suporte completo de backend e frontend para as seguintes entidades:

| Entidade | Tabela no Banco | Quantidade de Campos | Documentação Swagger |
|---|---|---|---|
${modelsRows}

---

## 📖 Documentações Detalhadas

- 📘 [Documentação Completa do Backend (Spring Boot)](./backend/README.md)
- 📙 [Documentação Completa do Frontend (Next.js)](./frontend/README.md)
`
}
