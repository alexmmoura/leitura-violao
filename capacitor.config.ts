import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App Android (arquivo .apk) — o mesmo app da web, empacotado com o Capacitor.
 * Os arquivos de `dist` vão DENTRO do .apk: funciona sem internet desde a instalação.
 * O .apk é montado no GitHub (.github/workflows/android.yml); ver README.
 */
const config: CapacitorConfig = {
  appId: 'io.github.alexmmoura.claves',
  appName: 'Claves',
  webDir: 'dist',
  android: {
    // o app guarda tudo no próprio aparelho; não precisa de conteúdo misto http
    allowMixedContent: false,
  },
  plugins: {
    // tela de ponta a ponta: a página recebe as margens da barra de status e da de navegação
    // (env(safe-area-inset-*)); ícones claros sobre o fundo escuro
    SystemBars: { insetsHandling: 'css', style: 'DARK', initialViewportFitValueHint: 'cover' },
  },
};

export default config;
