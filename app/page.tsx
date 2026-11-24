import Disciplines from "@/components/Disciplines";
import HeroLines from "@/components/HeroLines";
import HeroTitle from "@/components/HeroTitle";
import MagneticLink from "@/components/MagneticLink";
import SectionLabel from "@/components/SectionLabel";
import Services from "@/components/Services";
import Showreel from "@/components/Showreel";
import Testimonials from "@/components/Testimonials";
import TiltCard from "@/components/TiltCard";

const navigation = [
  { label: "Services", href: "#services" },
  { label: "Work", href: "#work" },
  { label: "Contact", href: "#contact" },
];

const projects = [
  {
    number: "01",
    name: "A new way to know",
    category: "AI · PRODUCT",
    className: "project-card--orbit",
    mark: "N",
  },
  {
    number: "02",
    name: "Signals in the noise",
    category: "DATA · EXPERIENCE",
    className: "project-card--signal",
    mark: "S",
  },
  {
    number: "03",
    name: "The human interface",
    category: "BRAND · DIGITAL",
    className: "project-card--human",
    mark: "H",
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a aria-label="Synapse home" className="wordmark" href="#hero">
          synapse<span>®</span>
        </a>
        <nav aria-label="Main navigation" className="main-nav">
          {navigation.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <a className="header-cta" href="#contact">
          Let&apos;s talk <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section aria-labelledby="hero-title" className="section hero" id="hero">
        <HeroLines />
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> Independent AI studio · Est. 2024</p>
          <HeroTitle />
          <p className="hero-description">
            We make thoughtful digital experiences for a world that won&apos;t
            sit still.
          </p>
          <a className="text-link" href="#services">
            Discover what we do <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div aria-hidden="true" className="hero-art">
          <div className="hero-art__halo hero-art__halo--outer" />
          <div className="hero-art__halo hero-art__halo--middle" />
          <div className="hero-art__halo hero-art__halo--inner" />
          <div className="hero-art__core">
            <span />
          </div>
          <span className="hero-art__label hero-art__label--top">HUMAN + MACHINE</span>
          <span className="hero-art__label hero-art__label--bottom">POTENTIAL, IN MOTION</span>
          <span className="hero-art__spark hero-art__spark--one" />
          <span className="hero-art__spark hero-art__spark--two" />
        </div>
        <div className="hero-footer">
          <span>Independent thinking, applied.</span>
          <span>Scroll to explore <span aria-hidden="true">↓</span></span>
        </div>
        <p aria-hidden="true" className="hero-hint">
          touch the lines · click &amp; hold to blast
        </p>
      </section>

      <Services />

      <Disciplines />

      <section aria-labelledby="work-title" className="section work" id="work">
        <div className="section-heading work-heading">
          <div>
            <SectionLabel>02 / Selected work</SectionLabel>
            <h2 id="work-title">
              Making the
              <br />
              <span className="muted">next feel natural.</span>
            </h2>
          </div>
          <p className="work-intro">
            A few signals from the future we&apos;re building with our partners.
          </p>
        </div>
        <div className="project-grid">
          {projects.map((project) => (
            <TiltCard
              className={`project-card ${project.className}`}
              key={project.number}
            >
              <div aria-hidden="true" className="project-art">
                <span className="project-art__mark">{project.mark}</span>
                <span className="project-art__ring project-art__ring--one" />
                <span className="project-art__ring project-art__ring--two" />
                <span className="project-art__ring project-art__ring--three" />
                <span className="project-art__grid" />
              </div>
              <div className="project-meta">
                <div>
                  <p>{project.category}</p>
                  <h3>{project.name}</h3>
                </div>
                <span className="project-number">{project.number}</span>
              </div>
            </TiltCard>
          ))}
        </div>
        <div className="section-footnote">
          <span>Curious what we could make together?</span>
          <a href="#contact">Start a conversation <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <Showreel />

      <Testimonials />

      <section
        aria-labelledby="contact-title"
        className="section contact"
        id="contact"
      >
        <SectionLabel><span className="status-dot" /> 03 / Your move</SectionLabel>
        <div className="contact-content">
          <h2 id="contact-title">
            Have a good
            <br />
            <span className="text-gradient">question?</span>
          </h2>
          <MagneticLink className="contact-link" href="mailto:hello@synapse.studio">
            Tell us about it <span aria-hidden="true">↗</span>
          </MagneticLink>
        </div>
        <div className="contact-bottom">
          <p>We believe the best answers start with better questions.</p>
          <div className="contact-details">
            <a href="mailto:hello@synapse.studio">hello@synapse.studio</a>
            <span>Independent by nature. Connected by design.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
