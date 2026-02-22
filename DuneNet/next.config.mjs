/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: [
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    '@react-three/postprocessing',
    'three-stdlib',
    'postprocessing',
  ],
  // Disable Turbopack - use webpack for Three.js compatibility
  experimental: {
    turbo: false,
  },
  webpack: (config, { isServer }) => {
    // Handle optional dependencies
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    });
    
    // Handle .glb and texture files
    config.module.rules.push({
      test: /\.(glb|gltf)$/,
      type: 'asset/resource',
    });
    
    return config;
  },
};

export default nextConfig;
