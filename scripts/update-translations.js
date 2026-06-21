const fs = require('fs');
const path = require('path');

const files = ['pt.json', 'en.json', 'es.json'];
const translationsDir = path.join(__dirname, '..', 'src', 'i18n', 'translations');

const translations = {
  pt: {
    navbar: {
      source_code: "Código Fonte (Export)"
    },
    security: {
      next_gen_title: "Autenticação de",
      next_gen_title_highlight: "Última Geração",
      next_gen_desc: "Proteja seus dados e o ambiente de seus desenvolvedores com políticas de acesso avançadas. Implementamos suporte nativo para biometria e Autenticação de Múltiplos Fatores (MFA).",
      passkey_title: "Login por Biometria (Passkey)",
      passkey_desc: "Diga adeus às senhas. Permita que seus usuários entrem no sistema usando FaceID, TouchID ou Windows Hello. Uma experiência premium, ultra-rápida e à prova de phishing.",
      mfa_title: "Autenticação Multi-Fator (MFA)",
      mfa_desc: "Segurança em nível corporativo. Como Owner do Workspace, você pode forçar o uso obrigatório de MFA para todos os desenvolvedores. Proteção garantida via Google Authenticator ou Authy.",
      app_sec_tag: "Para seus Clientes",
      app_sec_title: "Políticas de Segurança do App",
      app_sec_desc: "A mesma engenharia que protege o seu Workspace está disponível para os aplicativos que você gera para os seus clientes finais. No MetaBuilder Studio, você ativa Passkey ou MFA para os seus usuários finais em apenas 1 clique."
    },
    source_code: {
      hero_title: "Exportação Completa.",
      hero_title_highlight: "Seu Código Fonte.",
      hero_desc: "Não acredite em \"No-Code\" caixa-preta. No MetaBuilderPRO, o código fonte do aplicativo que você constrói pertence a você. Baixe um boilerplate limpo, documentado e pronto para produção a qualquer momento.",
      tech_title: "Código Next.js Nativo",
      tech_desc: "Exportado utilizando App Router, TailwindCSS e TypeScript estrito. Sem bibliotecas proprietárias que te prendem ao ecossistema.",
      tag_clean_code: "Clean Code",
      tag_hexagonal: "Arquitetura Hexagonal",
      block1_title: "Qualidade de Engenharia",
      block1_desc: "Nosso gerador não cria apenas \"código que funciona\". Ele cria código seguindo os padrões exigidos pelas grandes big techs (como DRY, SOLID e testes automatizados configurados). O Boilerplate que você baixa serve de fundação para equipes de alto nível.",
      block2_title: "Evolua sem Limites",
      block2_desc: "Começou construindo as telas via interface visual do MetaBuilder, mas a complexidade aumentou? Sem problemas. Exporte o código fonte inteiro e continue o desenvolvimento no VSCode com sua equipe. O lock-in é zero.",
      footer_title: "Soberania Total.",
      footer_desc: "Diferente das plataformas no-code tradicionais, você possui acesso irrestrito a cada linha de código gerada. Crie a infraestrutura e a inteligência do seu app aqui, e leve o código para qualquer lugar."
    }
  },
  en: {
    navbar: {
      source_code: "Source Code (Export)"
    },
    security: {
      next_gen_title: "Next-Generation",
      next_gen_title_highlight: "Authentication",
      next_gen_desc: "Protect your data and your developers' environment with advanced access policies. We implemented native support for biometrics and Multi-Factor Authentication (MFA).",
      passkey_title: "Biometric Login (Passkey)",
      passkey_desc: "Say goodbye to passwords. Let your users log into the system using FaceID, TouchID, or Windows Hello. A premium, ultra-fast, and phishing-proof experience.",
      mfa_title: "Multi-Factor Authentication (MFA)",
      mfa_desc: "Enterprise-grade security. As a Workspace Owner, you can enforce mandatory MFA for all developers. Guaranteed protection via Google Authenticator or Authy.",
      app_sec_tag: "For Your Clients",
      app_sec_title: "App Security Policies",
      app_sec_desc: "The same engineering that protects your Workspace is available for the applications you generate for your end users. In MetaBuilder Studio, you can enable Passkey or MFA for your end users with just 1 click."
    },
    source_code: {
      hero_title: "Full Export.",
      hero_title_highlight: "Your Source Code.",
      hero_desc: "Don't believe in black-box \"No-Code\". In MetaBuilderPRO, the source code of the app you build belongs to you. Download a clean, documented, and production-ready boilerplate at any time.",
      tech_title: "Native Next.js Code",
      tech_desc: "Exported using App Router, TailwindCSS, and strict TypeScript. No proprietary libraries that lock you into the ecosystem.",
      tag_clean_code: "Clean Code",
      tag_hexagonal: "Hexagonal Architecture",
      block1_title: "Engineering Quality",
      block1_desc: "Our generator doesn't just create \"code that works\". It creates code following the standards demanded by big tech companies (like DRY, SOLID, and configured automated tests). The Boilerplate you download serves as a foundation for high-level teams.",
      block2_title: "Evolve Without Limits",
      block2_desc: "Started building screens via the MetaBuilder visual interface, but complexity increased? No problem. Export the entire source code and continue development in VSCode with your team. Zero lock-in.",
      footer_title: "Total Sovereignty.",
      footer_desc: "Unlike traditional no-code platforms, you have unrestricted access to every line of generated code. Create your app's infrastructure and intelligence here, and take the code anywhere."
    }
  },
  es: {
    navbar: {
      source_code: "Código Fuente (Export)"
    },
    security: {
      next_gen_title: "Autenticación de",
      next_gen_title_highlight: "Última Generación",
      next_gen_desc: "Protege tus datos y el entorno de tus desarrolladores con políticas de acceso avanzadas. Hemos implementado soporte nativo para biometría y Autenticación Multifactor (MFA).",
      passkey_title: "Inicio de sesión Biométrico (Passkey)",
      passkey_desc: "Dile adiós a las contraseñas. Permite que tus usuarios ingresen al sistema usando FaceID, TouchID o Windows Hello. Una experiencia premium, ultrarrápida y a prueba de phishing.",
      mfa_title: "Autenticación Multifactor (MFA)",
      mfa_desc: "Seguridad de nivel empresarial. Como Propietario del Workspace, puedes forzar el uso obligatorio de MFA para todos los desarrolladores. Protección garantizada vía Google Authenticator o Authy.",
      app_sec_tag: "Para tus Clientes",
      app_sec_title: "Políticas de Seguridad de la App",
      app_sec_desc: "La misma ingeniería que protege tu Workspace está disponible para las aplicaciones que generas para tus usuarios finales. En MetaBuilder Studio, puedes activar Passkey o MFA para tus usuarios finales con solo 1 clic."
    },
    source_code: {
      hero_title: "Exportación Completa.",
      hero_title_highlight: "Tu Código Fuente.",
      hero_desc: "No creas en el \"No-Code\" de caja negra. En MetaBuilderPRO, el código fuente de la app que construyes te pertenece. Descarga un boilerplate limpio, documentado y listo para producción en cualquier momento.",
      tech_title: "Código Next.js Nativo",
      tech_desc: "Exportado usando App Router, TailwindCSS y TypeScript estricto. Sin bibliotecas propietarias que te aten al ecosistema.",
      tag_clean_code: "Clean Code",
      tag_hexagonal: "Arquitectura Hexagonal",
      block1_title: "Calidad de Ingeniería",
      block1_desc: "Nuestro generador no solo crea \"código que funciona\". Crea código siguiendo los estándares exigidos por las grandes empresas tecnológicas (como DRY, SOLID y pruebas automatizadas configuradas). El Boilerplate que descargas sirve de base para equipos de alto nivel.",
      block2_title: "Evoluciona sin Límites",
      block2_desc: "¿Empezaste construyendo las pantallas a través de la interfaz visual de MetaBuilder, pero la complejidad aumentó? No hay problema. Exporta todo el código fuente y continúa el desarrollo en VSCode con tu equipo. Cero lock-in.",
      footer_title: "Soberanía Total.",
      footer_desc: "A diferencia de las plataformas no-code tradicionales, tienes acceso sin restricciones a cada línea de código generada. Crea la infraestructura e inteligencia de tu app aquí, y lleva el código a cualquier lugar."
    }
  }
};

for (const file of files) {
  const filePath = path.join(translationsDir, file);
  if (fs.existsSync(filePath)) {
    const lang = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!data.marketing_v2.features) {
      data.marketing_v2.features = {};
    }
    
    if (!data.marketing_v2.features.security) {
        data.marketing_v2.features.security = {};
    }
    
    data.marketing_v2.navbar.source_code = translations[lang].navbar.source_code;
    
    data.marketing_v2.features.security = {
        ...data.marketing_v2.features.security,
        ...translations[lang].security
    };
    
    data.marketing_v2.features.source_code = translations[lang].source_code;
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Updated ${file}`);
  }
}
