'use client';

import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex items-center justify-center">
      <Image
        src="/logo.png"
        alt="Logo"
        width={72}
        height={72}
        className="flex-shrink-0 animate-scale"
        priority
      />
    </div>
  );
}
