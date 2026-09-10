import { AppAST } from '../ast'

/**
 * java-spring-backend.ts — Gerador do backend Spring Boot (Módulo 5)
 *
 * TODO (Fase 2 — Gemini Pro High): Implementar conforme Módulos 5.x + 8 do plano.
 * - generatePomXml         → backend/pom.xml
 * - generateApplicationProperties → backend/src/main/resources/application.properties
 * - generateMainClass      → backend/src/main/java/{groupPath}/Application.java
 * - generateEntityClass    → backend/src/main/java/{groupPath}/entities/{Model}.java
 * - generateRepositoryInterface → backend/src/main/java/{groupPath}/repositories/{Model}Repository.java
 * - generateServiceClass   → backend/src/main/java/{groupPath}/services/{Model}Service.java
 * - generateControllerClass → backend/src/main/java/{groupPath}/controllers/{Model}Controller.java
 * - generateCorsConfig     → backend/src/main/java/{groupPath}/config/CorsConfig.java
 * - generateOpenApiConfig  → backend/src/main/java/{groupPath}/config/OpenApiConfig.java
 * - generateReadmeMd       → backend/README.md
 */
export function generateSpringBootBackend(ast: AppAST, files: Map<string, string>): void {
  // STUB — será implementado na Fase 2 pelo Gemini Pro High
  files.set('backend/README.md', `# ${ast.projectName} — Backend Spring Boot\n\n> TODO: implementar gerador Spring Boot.\n`)
}
