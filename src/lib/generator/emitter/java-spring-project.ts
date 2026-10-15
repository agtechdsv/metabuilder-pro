import { AppAST } from '../ast'
import { generateJavaFrontend } from './java-spring-frontend'
import { generateSpringBootBackend, generateRootReadme, randomJwtSecret } from './java-spring-backend'
import { assertPolicySupported } from '../layers/access'
import { accessSql } from '../accessAdmin'
import { MAVEN_WRAPPER_FILES } from '../mavenWrapper.generated'
import { javaNeedsAccess } from './java-spring-access'

/**
 * java-spring-project.ts — Orquestrador do modo java-spring (Módulo 4)
 *
 * Gera um ZIP com estrutura dupla:
 *   frontend/  → Next.js chamando REST API (sem acesso direto ao banco)
 *   backend/   → Spring Boot 3.x + Java 21 com Entity/Repository/Service/Controller
 *   README.md  → Documentação master raiz do projeto full-stack
 */
export function generateJavaSpringProject(ast: AppAST): Map<string, string> {
  // acesso por linha configurado no projeto não é aplicado pelo backend Java: recusa em vez de exportar sem a proteção
  assertPolicySupported(ast)

  const files = new Map<string, string>()

  // BLOCO 1 — Frontend Next.js (modo REST client)
  // o segredo JWT é um só: o backend valida e o frontend assina com ele
  const jwtSecret = randomJwtSecret()
  generateJavaFrontend(ast, files, jwtSecret)

  // BLOCO 2 — Backend Spring Boot
  generateSpringBootBackend(ast, files, jwtSecret)

  // Script das tabelas de acesso: é do banco do backend, então fica na raiz (e não dentro do frontend)
  if (ast.accessAdmin) {
    files.delete('frontend/db/access-control.sql')
    files.set('db/access-control.sql', accessSql(ast))
    // o backend roda o mesmo script ao subir (spring.sql.init): cria só o que falta
    files.set('backend/src/main/resources/db/access-control.sql', accessSql(ast))
  }

  // Maven Wrapper: rodar o backend não exige Maven instalado (o wrapper baixa o Maven na primeira execução; é o mesmo que a IDE Local usa)
  for (const [name, content] of Object.entries(MAVEN_WRAPPER_FILES)) files.set(`backend/${name}`, content)

  // Notas no README do backend: como rodar sem Maven instalado e, se houver, como o acesso por linha funciona
  const readme = files.get('backend/README.md')
  if (readme) {
    let extra = [
      '',
      '## ▶️ Rodando sem instalar o Maven',
      '',
      'A pasta já traz o Maven Wrapper: na primeira execução ele baixa o Maven sozinho. Só é preciso o **JDK ' + (ast.javaVersion ?? 21) + '**.',
      '',
      '```bash',
      './mvnw spring-boot:run        # Linux/macOS',
      '.\\mvnw.cmd spring-boot:run     # Windows',
      '```',
      '',
      'Na IDE do MetaBuilder o JDK 21 portátil fica em `%USERPROFILE%\\.metabuilder\\jdk21` e é usado automaticamente.',
    ]
    if (javaNeedsAccess(ast)) {
      extra = extra.concat([
        '',
        '## 🔐 Acesso por linha, tabelas bloqueadas e auditoria',
        '',
        'As regras configuradas no projeto estão em `src/main/resources/mb-access.json` e valem em toda consulta e gravação (pacote `access`).',
        'O usuário vem no JWT que o frontend assina a cada chamada (e-mail, nome e colunas do cadastro). Sem usuário, ou sem o dado que a regra pede, a tabela fica negada.',
        'Chamadas internas do app (login e telas de gestão de acesso) vão marcadas como sistema e não passam pelas regras do usuário final.',
        'Colunas de auditoria (criado/atualizado em/por) são preenchidas pelo servidor; o que a tela enviar nelas é descartado.',
      ])
    }
    files.set('backend/README.md', readme + extra.join(String.fromCharCode(10)) + String.fromCharCode(10))
  }

  // BLOCO 3 — Root README
  files.set('README.md', generateRootReadme(ast))

  return files
}

