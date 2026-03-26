export default function Hero() {
  return (
    <section className="hero">
      <h1>Turn any TV into a retro split-flap display.</h1>
      <p className="subtitle">
        The classic flip-board look, without the $3,500 hardware.<br />
        Free and open source.
      </p>
      <div className="scroll-indicator">
        <span>Scroll</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </div>
    </section>
  );
}
