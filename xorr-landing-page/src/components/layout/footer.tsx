'use client';

import Link from 'next/link';
import Image from 'next/image';
import { HelpCircle, BookOpen, FileText, Users } from 'lucide-react';

interface IconProps {
  className?: string;
}

const GithubIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
  </svg>
);

const XIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const DiscordIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9460 2.4189-2.1568 2.4189z" />
  </svg>
);

const exploreLinks = [
  {
    icon: HelpCircle,
    title: 'How shielding works',
    description: 'See how public USDC becomes an unlinkable note and how every spend is proven on-chain',
    href: '#methodology',
    external: false,
  },
  {
    icon: BookOpen,
    title: 'Zero-knowledge proving',
    description: 'Learn how Groth16 proofs are built in the browser and verified by BN254 on Soroban',
    href: '#features',
    external: false,
  },
  {
    icon: FileText,
    title: 'ETH → Stellar bridge',
    description: 'Explore the ZK bridge — lock ETH on Sepolia, arrive as a shielded note on Stellar',
    href: '#features',
    external: false,
  },
  {
    icon: Users,
    title: 'Community',
    description: 'Follow XORR on X, Discord, and Telegram',
    href: '#',
    external: false,
    socialLinks: [
      { name: 'X', href: '#' },
      { name: 'Discord', href: '#' },
      { name: 'Telegram', href: '#' },
    ],
  },
];

const footerLinks = {
  Product: [
    { name: 'Shielded wallet', href: process.env.NEXT_PUBLIC_APP_URL || 'https://app.xorr.finance' },
    { name: 'Private payments', href: '#features' },
    { name: 'ETH → Stellar bridge', href: '#features' },
    { name: 'View-key compliance', href: '#features' },
  ],
  Technology: [
    { name: 'BN254 Groth16 on Soroban', href: '#' },
    { name: 'Poseidon UTXO notes', href: '#' },
    { name: 'Circom + snarkjs circuits', href: '#' },
    { name: 'Built on Stellar', href: '#' },
  ],
  Developers: [
    { name: 'Launch app', href: process.env.NEXT_PUBLIC_APP_URL || 'https://app.xorr.finance' },
    { name: 'Soroban contracts', href: '#' },
    { name: 'ZK circuits', href: '#' },
    { name: 'Documentation', href: '#' },
  ],
  'Need help?': [
    { name: 'Documentation', href: '#' },
    { name: 'Contact', href: '#' },
  ],
};

const socialIcons = [
  { icon: GithubIcon, href: '#', label: 'GitHub' },
  { icon: XIcon, href: '#', label: 'X' },
  { icon: DiscordIcon, href: '#', label: 'Discord' },
];

export function Footer() {
  return (
    <footer className="relative w-full bg-transparent border-t border-white/5 mt-12">
      {/* Explore Section */}
      <div className="relative z-10 max-w-7xl mx-auto py-16">
        <h2 className="text-4xl md:text-5xl font-light text-foreground mb-12 text-[#ebebeb]">
          Explore <span className="font-semibold text-lime-accent">private money on Stellar</span>
        </h2>

        <div className="space-y-0">
          {exploreLinks.map((link) => (
            <Link
              key={link.title}
              href={link.href}
              className="group flex items-center justify-between py-6 border-b border-white/10 hover:border-lime-accent/40 transition-colors"
            >
              <div className="flex items-start gap-6">
                <link.icon className="w-6 h-6 text-white/40 mt-1 group-hover:text-lime-accent transition-colors" />
                <div>
                  <h3 className="text-xl md:text-2xl font-medium text-[#ebebeb] mb-1">
                    {link.title}
                  </h3>
                  <p className="text-white/60 text-sm md:text-base max-w-xl">
                    {link.socialLinks ? (
                      <>
                        Follow XORR on{' '}
                        {link.socialLinks.map((social, idx) => (
                          <span key={social.name}>
                            <span className="text-white hover:text-lime-accent hover:underline transition-colors">
                              {social.name}
                            </span>
                            {idx < link.socialLinks!.length - 1 && (
                              <span>{idx === link.socialLinks!.length - 2 ? ', and ' : ', '}</span>
                            )}
                          </span>
                        ))}
                      </>
                    ) : (
                      link.description
                    )}
                  </p>
                </div>
              </div>
              {link.external && (
                <svg
                  className="w-5 h-5 text-white/40 group-hover:text-lime-accent transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 17L17 7M17 7H7M17 7V17"
                  />
                </svg>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto py-10">
          <div className="flex flex-col lg:flex-row justify-between gap-10">
            {/* Social Icons */}
            <div className="flex items-center gap-4">
              {socialIcons.map((social) => (
                <Link
                  key={social.label}
                  href={social.href}
                  className="text-white/40 hover:text-lime-accent transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </Link>
              ))}
            </div>

            {/* Link Columns */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-16">
              {Object.entries(footerLinks).map(([category, links]) => (
                <div key={category}>
                  <h4 className="text-sm font-medium text-[#ebebeb] mb-4">{category}</h4>
                  <ul className="space-y-3">
                    {links.map((link) => (
                      <li key={link.name}>
                        <Link
                          href={link.href}
                          className="text-sm text-white/40 hover:text-lime-accent transition-colors"
                        >
                          {link.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/5">
          <div className="max-w-7xl mx-auto py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-white/40 font-mono">
              <Image src="/logo.png" alt="XORR" width={20} height={20} />
              <span>&copy; {new Date().getFullYear()} - XORR (Built on Stellar)</span>
            </div>
            <div className="flex items-center gap-6 font-sans">
              <Link
                href="#"
                className="text-sm text-white/40 hover:text-lime-accent transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="#"
                className="text-sm text-white/40 hover:text-lime-accent transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
