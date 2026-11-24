import { cacheLife } from "next/cache";

// With cacheComponents on, reading the clock during prerender is an error unless
// it's cached. Capture the year in the static page and refresh it daily, so it
// rolls over after New Year without a rebuild.
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

const links = [
  { label: "Services", href: "#services" },
  { label: "Work", href: "#work" },
  { label: "Contact", href: "#contact" },
  { label: "Back to top", href: "#hero" },
];

// TODO: replace with the studio's own profile URLs.
const socials = [
  { label: "LinkedIn", href: "https://www.linkedin.com/" },
  { label: "Instagram", href: "https://www.instagram.com/" },
  { label: "X", href: "https://x.com/" },
  { label: "GitHub", href: "https://github.com/" },
];

// Page footer: wordmark, section links, socials and the copyright line. Opaque, so
// the fixed 3D canvas doesn't show through behind it.
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <a aria-label="Synapse home" className="wordmark" href="#hero">
            synapse<span>®</span>
          </a>
          <p>Independent AI studio. Useful by design, unexpected by nature.</p>
        </div>

        <nav aria-label="Footer" className="site-footer__column">
          <span className="site-footer__heading">Explore</span>
          {links.map((link) => (
            <a href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="site-footer__column">
          <span className="site-footer__heading">Follow</span>
          {socials.map((social) => (
            <a href={social.href} key={social.label} rel="noopener noreferrer" target="_blank">
              {social.label} <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </div>

      <div className="site-footer__bottom">
        <span>© <CopyrightYear /> Synapse Studio. All rights reserved.</span>
        <a href="mailto:hello@synapse.studio">hello@synapse.studio</a>
      </div>
    </footer>
  );
}
