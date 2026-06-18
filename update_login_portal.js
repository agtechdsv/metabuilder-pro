const fs = require('fs');

let content = fs.readFileSync('src/components/auth/LoginPortalClient.tsx', 'utf8');

// 1. Extract login_logo_url and login_banner_url
content = content.replace(
  "const allowSignup = visualConfig.allow_signup || false",
  `const allowSignup = visualConfig.allow_signup || false
  const loginLogoUrl = project.theme_config?.login_logo_url || ''
  const loginBannerUrl = project.theme_config?.login_banner_url || ''
  
  const hasBanner = !!loginBannerUrl`
);

// 2. Adjust the main layout wrapper depending on hasBanner
const newLayoutCode = `
  return (
    <TranslationProvider locale={locale}>
      <LoginPortalThemeWrapper theme={theme}>
        <div className={\`min-h-screen flex transition-colors duration-500 bg-neutral-50 dark:bg-[#050505] \${hasBanner ? 'flex-row' : 'flex-col'}\`}>
          {/* Left side (Form) */}
          <div className={\`flex flex-col flex-1 relative \${hasBanner ? 'max-w-[600px] xl:max-w-[700px]' : ''}\`}>
            <header className="p-6 flex justify-between items-center relative z-10">
              <div className="flex items-center gap-3">
                {loginLogoUrl ? (
                  <img src={loginLogoUrl} alt={project.name} className="h-8 w-auto object-contain" />
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center border transition-colors overflow-hidden bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                      {visualConfig.brand_icon || visualConfig.icon_svg ? (
                        <div dangerouslySetInnerHTML={{ __html: visualConfig.brand_icon || visualConfig.icon_svg }} className="w-6 h-6 flex items-center justify-center" />
                      ) : (
                        <LayoutTemplate className="w-6 h-6 text-neutral-400 dark:text-neutral-500" />
                      )}
                    </div>
                    <span className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                      {project.name}
                    </span>
                  </>
                )}
              </div>

              {!hasBanner && <HeaderActions hideUser hideTheme={theme !== 'auto'} />}
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative w-full">
              {!hasBanner && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-0 dark:opacity-100 transition-opacity duration-1000">
                  <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full" />
                  <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full" />
                </div>
              )}

              <div className={\`w-full max-w-sm \${!hasBanner ? 'rounded-[2.5rem] p-10 md:p-12 shadow-2xl border bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800' : ''} transition-all duration-500 relative z-10\`}>
                
                {/* Custom Icon when no Logo URL */}
                {!loginLogoUrl && !hasBanner && (
                  <div className="mb-8 flex justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                      {visualConfig.brand_icon || visualConfig.icon_svg ? (
                        <div dangerouslySetInnerHTML={{ __html: visualConfig.brand_icon || visualConfig.icon_svg }} className="w-10 h-10 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full" />
                      ) : (
                        <LayoutTemplate className="w-8 h-8" />
                      )}
                    </div>
                  </div>
                )}
                {hasBanner && loginLogoUrl && (
                  <div className="mb-8 hidden lg:flex justify-start">
                    <img src={loginLogoUrl} alt={project.name} className="h-10 w-auto object-contain" />
                  </div>
                )}

                <div className={\`mb-10 \${hasBanner ? 'text-left' : 'text-center'}\`}>
                  <h2 className="text-3xl font-bold mb-3 tracking-tight transition-colors text-neutral-900 dark:text-white">
                    {title}
                  </h2>
                  <p className="text-sm leading-relaxed transition-colors text-neutral-600 dark:text-neutral-500">
                    {subtitle}
                  </p>
                </div>
`;

// Find the return block and replace it up to the form rendering
content = content.replace(
  /return \(\s*<TranslationProvider locale=\{locale\}>\s*<LoginPortalThemeWrapper theme=\{theme\}>\s*<div className="min-h-screen flex flex-col transition-colors duration-500 bg-neutral-50 dark:bg-\[#050505\]">[\s\S]*?<div className="mb-10 text-center">\s*<h2 className="text-3xl font-bold mb-3 tracking-tight transition-colors text-neutral-900 dark:text-white">\s*\{title\}\s*<\/h2>\s*<p className="text-sm leading-relaxed transition-colors text-neutral-600 dark:text-neutral-500">\s*\{subtitle\}\s*<\/p>\s*<\/div>/,
  newLayoutCode
);

// 3. Add Right Side Banner code at the end
const endCode = `
              <div className="mt-10 flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-px bg-neutral-100 dark:bg-neutral-800" />
                  <span className="text-[9px] font-black text-neutral-300 dark:text-neutral-700 uppercase tracking-widest">
                    {t('runtime.login_powered_by')}
                  </span>
                  <div className="w-8 h-px bg-neutral-100 dark:bg-neutral-800" />
                </div>
              </div>
            </div>
          </main>

          <footer className="p-8 text-center text-[10px] font-medium text-neutral-400 dark:text-neutral-600">
             © {new Date().getFullYear()} AGTech Innovation Lab. All rights reserved.
          </footer>
          </div>

          {/* Right side (Banner) */}
          {hasBanner && (
            <div className="hidden lg:flex flex-1 relative bg-neutral-900 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
              <img 
                src={loginBannerUrl} 
                alt="Banner" 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[10s] hover:scale-105"
              />
              <div className="absolute top-6 right-6 z-20">
                <HeaderActions hideUser hideTheme={theme !== 'auto'} />
              </div>
              <div className="absolute bottom-12 left-12 right-12 z-20 text-white">
                 <h3 className="text-4xl font-bold mb-4 text-white shadow-black drop-shadow-xl">{project.name}</h3>
                 <p className="text-lg text-white/90 max-w-xl shadow-black drop-shadow-md">{project.description || 'Acesse o sistema e gerencie suas informações com segurança.'}</p>
              </div>
            </div>
          )}
        </div>
      </LoginPortalThemeWrapper>
    </TranslationProvider>
  )
}
`;

content = content.replace(
  /<div className="mt-10 flex flex-col items-center gap-4">[\s\S]*<\/TranslationProvider>\s*\)\s*\}/,
  endCode
);

fs.writeFileSync('src/components/auth/LoginPortalClient.tsx', content);
console.log('LoginPortalClient.tsx updated.');
