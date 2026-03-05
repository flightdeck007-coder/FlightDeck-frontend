'use client';

import { ConfigProvider } from 'antd';

export function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 6,
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
