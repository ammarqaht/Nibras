import Link from 'next/link';
import { site } from '@/content';

type Variant = 'lockup' | 'lockupVertical' | 'icon';

type BrandProps = {
  variant?: Variant;
  href?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
};

const SRC: Record<Variant, string> = {
  lockup: site.logos.lockupHorizontal,
  lockupVertical: site.logos.lockupVertical,
  icon: site.logos.icon
};

/** Nibras brand mark — uses the provided logo artwork. */
export default function Brand({
  variant = 'lockup',
  href,
  className = '',
  imgClassName = 'h-10 w-auto'
}: BrandProps) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC[variant]}
      alt={site.clubNameAr}
      className={`${imgClassName} select-none`}
      draggable={false}
    />
  );

  if (href) {
    return (
      <Link href={href} aria-label={site.clubNameAr} className={`inline-flex ${className}`}>
        {img}
      </Link>
    );
  }
  return <span className={`inline-flex ${className}`} aria-label={site.clubNameAr}>{img}</span>;
}
