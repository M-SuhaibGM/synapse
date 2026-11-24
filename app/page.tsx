const navigation = [
  { label: "Services", href: "#services" },
  { label: "Work", href: "#work" },
  { label: "Contact", href: "#contact" },
];

const services = [
  {
    number: "01",
    name: "AI experiences",
    description:
      "Intelligent products that feel intuitive, useful, and unmistakably human.",
    tags: "PRODUCT STRATEGY · AI UX",
  },
  {
    number: "02",
    name: "Digital products",
    description:
      "From first sketch to final pixel, we turn ambitious ideas into useful tools.",
    tags: "DESIGN · DEVELOPMENT",
  },
  {
    number: "03",
    name: "Creative technology",
    description:
      "New ways to tell stories, connect systems, and make the complex feel simple.",
    tags: "PROTOTYPING · R&D",
  },
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
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> Independent AI studio · Est. 2024</p>
          <h1 id="hero-title">
            Ideas into
            <br />
            <span className="text-gradient">intelligence.</span>
          </h1>
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
      </section>

      <section
        aria-labelledby="services-title"
        className="section services"
        id="services"
      >
        <div className="section-heading">
          <p className="eyebrow">01 / What we do</p>
          <h2 id="services-title">
            Useful by design.
            <br />
            <span className="muted">Unexpected by nature.</span>
          </h2>
        </div>
        <div className="service-list">
          {services.map((service) => (
            <article className="service-row" key={service.number}>
              <span className="service-number">{service.number}</span>
              <div className="service-main">
                <h3>{service.name}</h3>
                <p>{service.description}</p>
              </div>
              <span className="service-tags">{service.tags}</span>
              <span aria-hidden="true" className="service-arrow">↗</span>
            </article>
          ))}
        </div>
        <div className="section-footnote">
          <span>Good work starts with a good question.</span>
          <span>Based everywhere <span className="accent">●</span></span>
        </div>
      </section>

      <section aria-labelledby="work-title" className="section work" id="work">
        <div className="section-heading work-heading">
          <div>
            <p className="eyebrow">02 / Selected work</p>
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
            <article
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
            </article>
          ))}
        </div>
        <div className="section-footnote">
          <span>Curious what we could make together?</span>
          <a href="#contact">Start a conversation <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section
        aria-labelledby="contact-title"
        className="section contact"
        id="contact"
      >
        <p className="eyebrow"><span className="status-dot" /> 03 / Your move</p>
        <div className="contact-content">
          <h2 id="contact-title">
            Have a good
            <br />
            <span className="text-gradient">question?</span>
          </h2>
          <a className="contact-link" href="mailto:hello@synapse.studio">
            Tell us about it <span aria-hidden="true">↗</span>
          </a>
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
