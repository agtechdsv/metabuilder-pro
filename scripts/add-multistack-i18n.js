const fs = require('fs');
const path = require('path');

const translationsDir = path.join(__dirname, '..', 'src', 'i18n', 'translations');

const ptData = {
  home: {
    eject_badge: "Eject & Sync Multi-Stack",
    eject_badge_new: "NOVO",
    eject_title_part1: "Você escolhe a stack.",
    eject_title_part2: "Nós geramos o código.",
    eject_desc: "A maioria das plataformas gera um arquivo gigante e incompreensível. O MetaBuilder gera um projeto completo, modular e organizado por feature, pronto para produção — na linguagem e arquitetura que você escolher. Sem lock-in, com liberdade total.",
    eject_footer_hint: "Acesse a IDE para experimentar o seletor de backend no fluxo do Eject & Sync.",
    eject_btn_view_arch: "Ver arquitetura do código →",
    eject_btn_know_ide: "Conhecer a IDE"
  },
  ide: {
    eject_section_badge: "Eject & Sync Architecture",
    eject_section_badge_tag: "Multi-Stack Backend",
    eject_section_title_part1: "Eject & Sync — ",
    eject_section_title_part2: "Escolha sua Stack de Backend",
    eject_section_subtitle: "Exporte código profissional. Sem lock-in. Sem vendor dependência.",
    eject_diff_title: "Diferencial de Engenharia MetaBuilder PRO",
    eject_diff_desc: "A maioria das plataformas gera um arquivo gigante, ilegível e monolítico. O MetaBuilder gera um projeto completo, modular e organizado por feature, pronto para produção — na linguagem e arquitetura que sua equipe escolher.",
    eject_table_title: "Comparativo Direto de Capacidades no Eject",
    eject_table_col_feature: "Característica",
    eject_table_row_repo: "Repositório",
    eject_table_row_repo_node: "Monorepo / Projeto Único",
    eject_table_row_repo_java: "Pastas frontend/ e backend/ independentes",
    eject_table_row_lang: "Linguagem Backend",
    eject_table_row_lang_node: "Node.js + TypeScript",
    eject_table_row_lang_java: "Java 21 LTS (Virtual Threads habilitadas)",
    eject_table_row_docs: "Documentação de API",
    eject_table_row_docs_node: "Tipos TypeScript end-to-end",
    eject_table_row_docs_java: "Swagger / OpenAPI 3.0 interativo automático",
    eject_table_row_deploy: "Deploy",
    eject_table_row_deploy_node: "Vercel, AWS Amplify, Docker",
    eject_table_row_deploy_java: "Vercel (Front) + JAR / Kubernetes / JVM (Back)",
    eject_table_row_lockin: "Lock-in",
    eject_table_row_lockin_node: "Zero Lock-in (Código aberto padrão)",
    eject_table_row_lockin_java: "Zero Lock-in (Maven + Spring padrão)"
  },
  source_code: {
    eject_title_part1: "Você escolhe a stack de backend.",
    eject_title_part2: "Nós geramos a arquitetura limpa.",
    eject_desc: "A maioria das plataformas gera um arquivo gigante, confuso e monolítico. O MetaBuilder gera um projeto completo, organizado por feature, pronto para produção — na linguagem que você escolher.",
    sovereignty_title: "Soberania total sobre o seu código fonte",
    sovereignty_desc: "Faça o Eject a qualquer momento e continue desenvolvendo no VS Code, IntelliJ IDEA ou Eclipse com total compatibilidade.",
    sovereignty_btn: "Ver Eject na IDE"
  },
  multi_stack: {
    mode1_tag: "Modo 1 • Startup-Ready",
    mode1_tag_short: "Startup-Ready",
    mode1_title: "Next.js Full-Stack",
    mode1_tech: "(Node.js)",
    mode1_subtitle_home: "Frontend React + Backend Node.js no mesmo projeto unificado",
    mode1_subtitle_ide: "Frontend React + Backend Node.js no mesmo projeto Next.js",
    mode1_quote: "\"Startup-ready. Deploy rápido. Um projeto, zero configuração.\"",
    what_is_exported: "O QUE É EXPORTADO:",
    tree_title_project: "ESTRUTURA DO PROJETO GERADO:",
    tree_title_code: "ESTRUTURA DE CÓDIGO EXPORTADA:",
    
    mode1_item1_title: "Server Actions & API Routes",
    mode1_item1_desc_home: "Rotas de backend nativas Next.js com tipagem estrita TypeScript.",
    mode1_item1_desc_ide: "Ações de servidor e endpoints HTTP tipados nativos do Next.js App Router.",
    
    mode1_item2_title_home: "Configuração Imediata",
    mode1_item2_desc_home: "Arquivo .env.local pré-configurado com variáveis de banco e autenticação.",
    mode1_item2_title_ide: "Zero Configuração (.env.local)",
    mode1_item2_desc_ide: "Variáveis de conexão, tokens e segredos gerados automaticamente.",
    mode1_item2_desc_source: "Conexões de banco, chaves e variáveis já configuradas para rodar imediatamente.",
    
    mode1_item3_title: "Deploy Vercel-Ready",
    mode1_item3_desc_home: "Suba para produção em segundos na Vercel, AWS ou container Docker leve.",
    mode1_item3_desc_ide: "Um único comando vercel deploy ou build Docker pronto para nuvem.",
    mode1_item3_desc_source: "Deploy em 1 clique na Vercel, AWS ou imagem Docker otimizada.",
    
    mode1_item4_title_home: "Estrutura por Feature",
    mode1_item4_desc_home: "Código limpo, componentizado e modular para iterações ágeis.",
    mode1_item4_title_ide: "Ideal para",
    mode1_item4_desc_ide: "Startups, MVPs, provas de conceito e equipes ágeis que preferem JavaScript/TypeScript unificado.",
    mode1_item4_title_source: "Organização Modular",
    mode1_item4_desc_source: "Telas, componentes e server actions estruturados por feature sem poluição.",
    
    mode1_tree_api: "# Endpoints REST tipados",
    mode1_tree_pages: "# Telas e Server Actions",
    mode1_tree_components: "# Componentes reutilizáveis",
    mode1_tree_db: "# Client ORM e queries",
    mode1_tree_env: "# Conexões pré-configuradas",
    mode1_tree_api_alt: "# API Routes REST",
    mode1_tree_pages_alt: "# Pages & Server Actions",
    mode1_tree_ui_alt: "# UI Components",
    mode1_tree_env_alt: "# Conexões automáticas",
    
    mode1_footer_left_home: "Repositório Único Next.js",
    mode1_footer_left_ide: "📦 Projeto Full-Stack Único",
    mode1_footer_left_source: "📦 Repositório Único",
    mode1_footer_right_home: "Zero Lock-in",
    mode1_footer_right_ide: "Node.js LTS",
    mode1_footer_right_source: "Node.js / Next.js",

    mode2_tag: "Modo 2 • Enterprise-Grade",
    mode2_tag_short: "Enterprise-Grade",
    mode2_title: "Next.js + Spring Boot",
    mode2_tech: "(Java 21)",
    mode2_subtitle_home: "Frontend Next.js consumindo API REST gerada em Spring Boot 3.x",
    mode2_subtitle_ide: "Frontend Next.js chamando API REST gerada em Spring Boot 3.x",
    mode2_quote: "\"Enterprise-grade. Spring Boot 3.x + Java 21 com Virtual Threads. Frontend e backend independentes.\"",
    
    mode2_item1_title: "Virtual Threads (Project Loom)",
    mode2_item1_desc_home: "Alta concorrência e throughput massivo com consumo mínimo de memória no Java 21.",
    mode2_item1_desc_ide: "Suporte nativo a alta concorrência com threads virtuais do Java 21 ativadas.",
    mode2_item1_desc_source: "Java 21 com suporte nativo a milhares de requisições simultâneas e baixíssimo consumo.",
    
    mode2_item2_title_home: "Arquitetura Desacoplada",
    mode2_item2_desc_home: "Pastas frontend/ e backend/ separadas para deploys e times independentes.",
    mode2_item2_title_ide: "Pastas frontend/ e backend/ separadas",
    mode2_item2_desc_ide: "Deploys independentes em servidores, pipelines de CI/CD ou clusters Kubernetes distintos.",
    mode2_item2_title_source: "frontend/ + backend/ Desacoplados",
    mode2_item2_desc_source: "Separação total de código para deploys autônomos e governança corporativa.",
    
    mode2_item3_title_home: "Maven + Swagger Automático",
    mode2_item3_desc_home: "pom.xml com Spring Web, Data JPA, OpenAPI/Swagger 3 e CORS configurado.",
    mode2_item3_title_ide: "pom.xml & Swagger OpenAPI 3.0",
    mode2_item3_desc_ide: "Maven configurado com Spring Web, JPA/Hibernate, validações e documentação automática em /swagger-ui.html.",
    mode2_item3_title_source: "pom.xml & Swagger OpenAPI",
    mode2_item3_desc_source: "Dependências Maven completas com documentação viva gerada automaticamente.",
    
    mode2_item4_title_home: "Drivers de Banco Nativos",
    mode2_item4_desc_home: "PostgreSQL, Oracle e SQL Server prontos com pool HikariCP otimizado.",
    mode2_item4_title_ide: "CORS e Drivers Nativos",
    mode2_item4_desc_ide: "CORS pré-liberado para o Next.js e drivers adequados (PostgreSQL, Oracle, SQL Server) prontos no application.yml.",
    mode2_item4_desc_source: "CORS pré-configurado e suporte a PostgreSQL, Oracle e SQL Server no application.yml.",
    
    mode2_tree_frontend: "# Next.js 15 App Router",
    mode2_tree_backend: "# Spring Boot 3.x + Java 21",
    mode2_tree_maven: "# Maven Build + Swagger",
    mode2_tree_java: "# Controllers, Services, Entities",
    mode2_tree_resources: "# application.yml + Drivers",
    mode2_tree_frontend_alt: "# Next.js 15 (Client)",
    mode2_tree_backend_alt: "# Spring Boot 3.x (Java 21)",
    mode2_tree_maven_alt: "# Maven & Swagger",
    mode2_tree_java_alt: "# Clean Architecture",
    mode2_tree_resources_alt: "# application.yml",
    
    mode2_footer_left_home: "frontend/ + backend/ Desacoplados",
    mode2_footer_left_ide: "🏛️ Arquitetura Corporativa Desacoplada",
    mode2_footer_left_source: "🏛️ Deploy Desacoplado",
    mode2_footer_right_home: "Enterprise Ready",
    mode2_footer_right_ide: "Java 21 + Spring 3",
    mode2_footer_right_source: "Spring Boot 3.x + Java 21"
  }
};

const enData = {
  home: {
    eject_badge: "Eject & Sync Multi-Stack",
    eject_badge_new: "NEW",
    eject_title_part1: "You choose the stack.",
    eject_title_part2: "We generate the code.",
    eject_desc: "Most platforms generate a giant, messy god-file. MetaBuilder generates a complete, modular project organized by feature, production-ready — in the language and architecture of your choice. Zero lock-in, total freedom.",
    eject_footer_hint: "Access the IDE to experience the backend selector in the Eject & Sync workflow.",
    eject_btn_view_arch: "View code architecture →",
    eject_btn_know_ide: "Explore the IDE"
  },
  ide: {
    eject_section_badge: "Eject & Sync Architecture",
    eject_section_badge_tag: "Multi-Stack Backend",
    eject_section_title_part1: "Eject & Sync — ",
    eject_section_title_part2: "Choose your Backend Stack",
    eject_section_subtitle: "Export professional code. Zero lock-in. No vendor dependency.",
    eject_diff_title: "MetaBuilder PRO Engineering Differentiator",
    eject_diff_desc: "Most platforms generate a giant, unreadable, and monolithic file. MetaBuilder generates a complete, modular project organized by feature, production-ready — in the language and architecture your team chooses.",
    eject_table_title: "Direct Eject Capability Comparison",
    eject_table_col_feature: "Feature",
    eject_table_row_repo: "Repository",
    eject_table_row_repo_node: "Monorepo / Single Project",
    eject_table_row_repo_java: "Independent frontend/ and backend/ folders",
    eject_table_row_lang: "Backend Language",
    eject_table_row_lang_node: "Node.js + TypeScript",
    eject_table_row_lang_java: "Java 21 LTS (Virtual Threads enabled)",
    eject_table_row_docs: "API Documentation",
    eject_table_row_docs_node: "End-to-end TypeScript types",
    eject_table_row_docs_java: "Automatic interactive Swagger / OpenAPI 3.0",
    eject_table_row_deploy: "Deployment",
    eject_table_row_deploy_node: "Vercel, AWS Amplify, Docker",
    eject_table_row_deploy_java: "Vercel (Front) + JAR / Kubernetes / JVM (Back)",
    eject_table_row_lockin: "Lock-in",
    eject_table_row_lockin_node: "Zero Lock-in (Standard open source)",
    eject_table_row_lockin_java: "Zero Lock-in (Standard Maven + Spring)"
  },
  source_code: {
    eject_title_part1: "You choose the backend stack.",
    eject_title_part2: "We generate clean architecture.",
    eject_desc: "Most platforms generate a giant, messy, and monolithic file. MetaBuilder generates a complete project, organized by feature, production-ready — in the language of your choice.",
    sovereignty_title: "Total sovereignty over your source code",
    sovereignty_desc: "Eject at any time and continue developing in VS Code, IntelliJ IDEA, or Eclipse with full compatibility.",
    sovereignty_btn: "See Eject in IDE"
  },
  multi_stack: {
    mode1_tag: "Mode 1 • Startup-Ready",
    mode1_tag_short: "Startup-Ready",
    mode1_title: "Next.js Full-Stack",
    mode1_tech: "(Node.js)",
    mode1_subtitle_home: "React Frontend + Node.js Backend in the same unified project",
    mode1_subtitle_ide: "React Frontend + Node.js Backend in the same Next.js project",
    mode1_quote: "\"Startup-ready. Rapid deployment. One project, zero configuration.\"",
    what_is_exported: "WHAT IS EXPORTED:",
    tree_title_project: "GENERATED PROJECT STRUCTURE:",
    tree_title_code: "EXPORTED CODE STRUCTURE:",
    
    mode1_item1_title: "Server Actions & API Routes",
    mode1_item1_desc_home: "Native Next.js backend routes with strict TypeScript typing.",
    mode1_item1_desc_ide: "Native Next.js App Router server actions and typed HTTP endpoints.",
    
    mode1_item2_title_home: "Instant Configuration",
    mode1_item2_desc_home: ".env.local file pre-configured with database variables and auth.",
    mode1_item2_title_ide: "Zero Configuration (.env.local)",
    mode1_item2_desc_ide: "Connection variables, tokens, and secrets automatically generated.",
    mode1_item2_desc_source: "Database connections, keys, and variables already configured to run immediately.",
    
    mode1_item3_title: "Vercel-Ready Deployment",
    mode1_item3_desc_home: "Deploy to production in seconds on Vercel, AWS, or lightweight Docker container.",
    mode1_item3_desc_ide: "A single command vercel deploy or cloud-ready Docker build.",
    mode1_item3_desc_source: "1-click deploy to Vercel, AWS, or optimized Docker image.",
    
    mode1_item4_title_home: "Feature-Based Structure",
    mode1_item4_desc_home: "Clean, componentized, and modular code for agile iterations.",
    mode1_item4_title_ide: "Ideal for",
    mode1_item4_desc_ide: "Startups, MVPs, proof of concepts, and agile teams preferring unified JavaScript/TypeScript.",
    mode1_item4_title_source: "Modular Organization",
    mode1_item4_desc_source: "Screens, components, and server actions structured by feature without clutter.",
    
    mode1_tree_api: "# Typed REST endpoints",
    mode1_tree_pages: "# Pages & Server Actions",
    mode1_tree_components: "# Reusable UI components",
    mode1_tree_db: "# Client ORM & queries",
    mode1_tree_env: "# Pre-configured connections",
    mode1_tree_api_alt: "# REST API Routes",
    mode1_tree_pages_alt: "# Pages & Server Actions",
    mode1_tree_ui_alt: "# UI Components",
    mode1_tree_env_alt: "# Automatic connections",
    
    mode1_footer_left_home: "Single Next.js Repository",
    mode1_footer_left_ide: "📦 Single Full-Stack Project",
    mode1_footer_left_source: "📦 Single Repository",
    mode1_footer_right_home: "Zero Lock-in",
    mode1_footer_right_ide: "Node.js LTS",
    mode1_footer_right_source: "Node.js / Next.js",

    mode2_tag: "Mode 2 • Enterprise-Grade",
    mode2_tag_short: "Enterprise-Grade",
    mode2_title: "Next.js + Spring Boot",
    mode2_tech: "(Java 21)",
    mode2_subtitle_home: "Next.js Frontend consuming REST API generated in Spring Boot 3.x",
    mode2_subtitle_ide: "Next.js Frontend calling REST API generated in Spring Boot 3.x",
    mode2_quote: "\"Enterprise-grade. Spring Boot 3.x + Java 21 with Virtual Threads. Independent frontend and backend.\"",
    
    mode2_item1_title: "Virtual Threads (Project Loom)",
    mode2_item1_desc_home: "High concurrency and massive throughput with minimal memory overhead in Java 21.",
    mode2_item1_desc_ide: "Native high concurrency support with Java 21 virtual threads enabled.",
    mode2_item1_desc_source: "Java 21 with native support for thousands of concurrent requests and ultra-low footprint.",
    
    mode2_item2_title_home: "Decoupled Architecture",
    mode2_item2_desc_home: "Separate frontend/ and backend/ folders for autonomous deployments and teams.",
    mode2_item2_title_ide: "Separate frontend/ and backend/ folders",
    mode2_item2_desc_ide: "Independent deployments across different servers, CI/CD pipelines, or Kubernetes clusters.",
    mode2_item2_title_source: "Decoupled frontend/ + backend/",
    mode2_item2_desc_source: "Complete code separation for autonomous deployments and corporate governance.",
    
    mode2_item3_title_home: "Automated Maven + Swagger",
    mode2_item3_desc_home: "pom.xml with Spring Web, Data JPA, OpenAPI/Swagger 3, and CORS configured.",
    mode2_item3_title_ide: "pom.xml & Swagger OpenAPI 3.0",
    mode2_item3_desc_ide: "Maven configured with Spring Web, JPA/Hibernate, validations, and auto-docs at /swagger-ui.html.",
    mode2_item3_title_source: "pom.xml & Swagger OpenAPI",
    mode2_item3_desc_source: "Full Maven dependencies with living documentation generated automatically.",
    
    mode2_item4_title_home: "Native Database Drivers",
    mode2_item4_desc_home: "PostgreSQL, Oracle, and SQL Server ready with optimized HikariCP pool.",
    mode2_item4_title_ide: "CORS and Native Drivers",
    mode2_item4_desc_ide: "Pre-configured CORS for Next.js and matching drivers (PostgreSQL, Oracle, SQL Server) ready in application.yml.",
    mode2_item4_desc_source: "Pre-configured CORS and support for PostgreSQL, Oracle, and SQL Server in application.yml.",
    
    mode2_tree_frontend: "# Next.js 15 App Router",
    mode2_tree_backend: "# Spring Boot 3.x + Java 21",
    mode2_tree_maven: "# Maven Build + Swagger",
    mode2_tree_java: "# Controllers, Services, Entities",
    mode2_tree_resources: "# application.yml + Drivers",
    mode2_tree_frontend_alt: "# Next.js 15 (Client)",
    mode2_tree_backend_alt: "# Spring Boot 3.x (Java 21)",
    mode2_tree_maven_alt: "# Maven & Swagger",
    mode2_tree_java_alt: "# Clean Architecture",
    mode2_tree_resources_alt: "# application.yml",
    
    mode2_footer_left_home: "Decoupled frontend/ + backend/",
    mode2_footer_left_ide: "🏛️ Decoupled Enterprise Architecture",
    mode2_footer_left_source: "🏛️ Decoupled Deployment",
    mode2_footer_right_home: "Enterprise Ready",
    mode2_footer_right_ide: "Java 21 + Spring 3",
    mode2_footer_right_source: "Spring Boot 3.x + Java 21"
  }
};

const esData = {
  home: {
    eject_badge: "Eject & Sync Multi-Stack",
    eject_badge_new: "NUEVO",
    eject_title_part1: "Tú eliges el stack.",
    eject_title_part2: "Nosotros generamos el código.",
    eject_desc: "La mayoría de las plataformas generan un archivo gigante e incomprensible. MetaBuilder genera un proyecto completo, modular y organizado por feature, listo para producción — en el lenguaje y arquitectura que elijas. Cero lock-in, total libertad.",
    eject_footer_hint: "Accede al IDE para experimentar el selector de backend en el flujo de Eject & Sync.",
    eject_btn_view_arch: "Ver arquitectura del código →",
    eject_btn_know_ide: "Conocer el IDE"
  },
  ide: {
    eject_section_badge: "Arquitectura Eject & Sync",
    eject_section_badge_tag: "Backend Multi-Stack",
    eject_section_title_part1: "Eject & Sync — ",
    eject_section_title_part2: "Elige tu Stack de Backend",
    eject_section_subtitle: "Exporta código profesional. Sin lock-in. Sin dependencia de proveedor.",
    eject_diff_title: "Diferencial de Ingeniería MetaBuilder PRO",
    eject_diff_desc: "La mayoría de las plataformas generan un archivo gigante, ilegible y monolítico. MetaBuilder genera un proyecto completo, modular y organizado por feature, listo para producción — en el lenguaje y arquitectura que tu equipo elija.",
    eject_table_title: "Comparativa Directa de Capacidades en el Eject",
    eject_table_col_feature: "Característica",
    eject_table_row_repo: "Repositorio",
    eject_table_row_repo_node: "Monorepo / Proyecto Único",
    eject_table_row_repo_java: "Carpetas frontend/ y backend/ independientes",
    eject_table_row_lang: "Lenguaje Backend",
    eject_table_row_lang_node: "Node.js + TypeScript",
    eject_table_row_lang_java: "Java 21 LTS (Virtual Threads habilitadas)",
    eject_table_row_docs: "Documentación de API",
    eject_table_row_docs_node: "Tipos TypeScript end-to-end",
    eject_table_row_docs_java: "Swagger / OpenAPI 3.0 interactivo automático",
    eject_table_row_deploy: "Despliegue",
    eject_table_row_deploy_node: "Vercel, AWS Amplify, Docker",
    eject_table_row_deploy_java: "Vercel (Front) + JAR / Kubernetes / JVM (Back)",
    eject_table_row_lockin: "Lock-in",
    eject_table_row_lockin_node: "Cero Lock-in (Código abierto estándar)",
    eject_table_row_lockin_java: "Cero Lock-in (Maven + Spring estándar)"
  },
  source_code: {
    eject_title_part1: "Tú eliges el stack de backend.",
    eject_title_part2: "Nosotros generamos la arquitectura limpia.",
    eject_desc: "La mayoría de las plataformas generan un archivo gigante, confuso y monolítico. MetaBuilder genera un proyecto completo, organizado por feature, listo para producción — en el lenguaje que elijas.",
    sovereignty_title: "Soberanía total sobre tu código fuente",
    sovereignty_desc: "Haz el Eject en cualquier momento y continúa desarrollando en VS Code, IntelliJ IDEA o Eclipse con total compatibilidad.",
    sovereignty_btn: "Ver Eject en el IDE"
  },
  multi_stack: {
    mode1_tag: "Modo 1 • Startup-Ready",
    mode1_tag_short: "Startup-Ready",
    mode1_title: "Next.js Full-Stack",
    mode1_tech: "(Node.js)",
    mode1_subtitle_home: "Frontend React + Backend Node.js en el mismo proyecto unificado",
    mode1_subtitle_ide: "Frontend React + Backend Node.js en el mismo proyecto Next.js",
    mode1_quote: "\"Startup-ready. Despliegue rápido. Un proyecto, cero configuración.\"",
    what_is_exported: "QUÉ SE EXPORTA:",
    tree_title_project: "ESTRUCTURA DEL PROYECTO GENERADO:",
    tree_title_code: "ESTRUCTURA DE CÓDIGO EXPORTADA:",
    
    mode1_item1_title: "Server Actions & API Routes",
    mode1_item1_desc_home: "Rutas de backend nativas de Next.js con tipado estricto en TypeScript.",
    mode1_item1_desc_ide: "Acciones de servidor y endpoints HTTP tipados nativos de Next.js App Router.",
    
    mode1_item2_title_home: "Configuración Inmediata",
    mode1_item2_desc_home: "Archivo .env.local preconfigurado con variables de base de datos y autenticación.",
    mode1_item2_title_ide: "Cero Configuración (.env.local)",
    mode1_item2_desc_ide: "Variables de conexión, tokens y secretos generados automáticamente.",
    mode1_item2_desc_source: "Conexiones de base de datos, claves y variables ya configuradas para ejecutarse de inmediato.",
    
    mode1_item3_title: "Despliegue Vercel-Ready",
    mode1_item3_desc_home: "Sube a producción en segundos en Vercel, AWS o contenedor Docker ligero.",
    mode1_item3_desc_ide: "Un solo comando vercel deploy o build de Docker listo para la nube.",
    mode1_item3_desc_source: "Despliegue en 1 clic en Vercel, AWS o imagen Docker optimizada.",
    
    mode1_item4_title_home: "Estructura por Feature",
    mode1_item4_desc_home: "Código limpio, componentizado y modular para iteraciones ágiles.",
    mode1_item4_title_ide: "Ideal para",
    mode1_item4_desc_ide: "Startups, MVPs, pruebas de concepto y equipos ágiles que prefieren JavaScript/TypeScript unificado.",
    mode1_item4_title_source: "Organización Modular",
    mode1_item4_desc_source: "Pantallas, componentes y server actions estructurados por feature sin saturación.",
    
    mode1_tree_api: "# Endpoints REST tipados",
    mode1_tree_pages: "# Pantallas y Server Actions",
    mode1_tree_components: "# Componentes reutilizables",
    mode1_tree_db: "# Cliente ORM y consultas",
    mode1_tree_env: "# Conexiones preconfiguradas",
    mode1_tree_api_alt: "# Rutas API REST",
    mode1_tree_pages_alt: "# Pantallas y Server Actions",
    mode1_tree_ui_alt: "# Componentes UI",
    mode1_tree_env_alt: "# Conexiones automáticas",
    
    mode1_footer_left_home: "Repositorio Único Next.js",
    mode1_footer_left_ide: "📦 Proyecto Full-Stack Único",
    mode1_footer_left_source: "📦 Repositorio Único",
    mode1_footer_right_home: "Cero Lock-in",
    mode1_footer_right_ide: "Node.js LTS",
    mode1_footer_right_source: "Node.js / Next.js",

    mode2_tag: "Modo 2 • Enterprise-Grade",
    mode2_tag_short: "Enterprise-Grade",
    mode2_title: "Next.js + Spring Boot",
    mode2_tech: "(Java 21)",
    mode2_subtitle_home: "Frontend Next.js consumiendo API REST generada en Spring Boot 3.x",
    mode2_subtitle_ide: "Frontend Next.js llamando a API REST generada en Spring Boot 3.x",
    mode2_quote: "\"Enterprise-grade. Spring Boot 3.x + Java 21 con Virtual Threads. Frontend y backend independientes.\"",
    
    mode2_item1_title: "Virtual Threads (Project Loom)",
    mode2_item1_desc_home: "Alta concurrencia y throughput masivo con consumo mínimo de memoria en Java 21.",
    mode2_item1_desc_ide: "Soporte nativo para alta concurrencia con hilos virtuales de Java 21 activados.",
    mode2_item1_desc_source: "Java 21 con soporte nativo para miles de peticiones simultáneas y bajísimo consumo.",
    
    mode2_item2_title_home: "Arquitectura Desacoplada",
    mode2_item2_desc_home: "Carpetas frontend/ y backend/ separadas para despliegues y equipos independientes.",
    mode2_item2_title_ide: "Carpetas frontend/ y backend/ separadas",
    mode2_item2_desc_ide: "Despliegues independientes en servidores, pipelines de CI/CD o clusters de Kubernetes distintos.",
    mode2_item2_title_source: "frontend/ + backend/ Desacoplados",
    mode2_item2_desc_source: "Separación total de código para despliegues autónomos y gobernanza corporativa.",
    
    mode2_item3_title_home: "Maven + Swagger Automático",
    mode2_item3_desc_home: "pom.xml con Spring Web, Data JPA, OpenAPI/Swagger 3 y CORS configurado.",
    mode2_item3_title_ide: "pom.xml & Swagger OpenAPI 3.0",
    mode2_item3_desc_ide: "Maven configurado con Spring Web, JPA/Hibernate, validaciones y documentación automática en /swagger-ui.html.",
    mode2_item3_title_source: "pom.xml & Swagger OpenAPI",
    mode2_item3_desc_source: "Dependencias Maven completas con documentación viva generada automáticamente.",
    
    mode2_item4_title_home: "Drivers de Base de Datos Nativos",
    mode2_item4_desc_home: "PostgreSQL, Oracle y SQL Server listos con pool HikariCP optimizado.",
    mode2_item4_title_ide: "CORS y Drivers Nativos",
    mode2_item4_desc_ide: "CORS prehabilitado para Next.js y drivers adecuados (PostgreSQL, Oracle, SQL Server) listos en application.yml.",
    mode2_item4_desc_source: "CORS preconfigurado y soporte para PostgreSQL, Oracle y SQL Server en application.yml.",
    
    mode2_tree_frontend: "# Next.js 15 App Router",
    mode2_tree_backend: "# Spring Boot 3.x + Java 21",
    mode2_tree_maven: "# Maven Build + Swagger",
    mode2_tree_java: "# Controllers, Services, Entities",
    mode2_tree_resources: "# application.yml + Drivers",
    mode2_tree_frontend_alt: "# Next.js 15 (Client)",
    mode2_tree_backend_alt: "# Spring Boot 3.x (Java 21)",
    mode2_tree_maven_alt: "# Maven & Swagger",
    mode2_tree_java_alt: "# Clean Architecture",
    mode2_tree_resources_alt: "# application.yml",
    
    mode2_footer_left_home: "frontend/ + backend/ Desacoplados",
    mode2_footer_left_ide: "🏛️ Arquitectura Corporativa Desacoplada",
    mode2_footer_left_source: "🏛️ Despliegue Desacoplado",
    mode2_footer_right_home: "Enterprise Ready",
    mode2_footer_right_ide: "Java 21 + Spring 3",
    mode2_footer_right_source: "Spring Boot 3.x + Java 21"
  }
};

const bundle = {
  pt: ptData,
  en: enData,
  es: esData
};

for (const lang of ['pt', 'en', 'es']) {
  const filePath = path.join(translationsDir, `${lang}.json`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(content);

  if (!json.marketing_v2) json.marketing_v2 = {};
  if (!json.marketing_v2.home) json.marketing_v2.home = {};
  if (!json.marketing_v2.features) json.marketing_v2.features = {};
  if (!json.marketing_v2.features.ide) json.marketing_v2.features.ide = {};
  if (!json.marketing_v2.features.source_code) json.marketing_v2.features.source_code = {};

  // Merge home
  Object.assign(json.marketing_v2.home, bundle[lang].home);

  // Merge ide
  Object.assign(json.marketing_v2.features.ide, bundle[lang].ide);

  // Merge source_code
  Object.assign(json.marketing_v2.features.source_code, bundle[lang].source_code);

  // Add multi_stack
  json.marketing_v2.multi_stack = bundle[lang].multi_stack;

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf-8');
  console.log(`Successfully updated ${lang}.json`);
}
