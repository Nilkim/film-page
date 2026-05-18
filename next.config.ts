import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 대표 이미지 업로드 때문에 기본 1MB로는 부족.
      // actions.ts에서 이미지 5MB로 제한하고 있어 6MB로 넉넉히 잡음.
      // 추후 다중 이미지나 더 큰 파일이 필요해지면 클라이언트 측에서
      // Supabase Storage로 직접 업로드하는 방식으로 갈아엎을 것.
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
