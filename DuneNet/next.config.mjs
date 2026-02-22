/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  transpilePackages: [
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    '@react-three/postprocessing',
    'three-stdlib',
    'postprocessing',
  ],
  turbopack: {},
};

export default nextConfig;
