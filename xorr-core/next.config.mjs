import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    unoptimized: true,
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Cross-origin isolation lets snarkjs use SharedArrayBuffer / threaded
          // proving when available (it falls back to single-thread otherwise).
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    // snarkjs / circomlibjs / @stellar/stellar-sdk expect Node builtins in the
    // browser. Vite handled this via vite-plugin-node-polyfills; webpack needs
    // explicit fallbacks + globals.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser'),
        stream: require.resolve('stream-browserify'),
        crypto: require.resolve('crypto-browserify'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        os: require.resolve('os-browserify/browser'),
        path: require.resolve('path-browserify'),
        url: require.resolve('url'),
        assert: require.resolve('assert'),
        zlib: require.resolve('browserify-zlib'),
        events: require.resolve('events'),
        vm: false,
      };

      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        }),
      );
    }

    // WASM (snarkjs / circom artifacts) support.
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // RainbowKit / wagmi pull React-Native-only transitive deps that can't
    // resolve in a web build.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      // optional pretty-printer pulled in by @walletconnect/logger — not needed
      // in the browser; aliasing it away silences a build warning.
      'pino-pretty': false,
    };

    return config;
  },
};

export default nextConfig;
