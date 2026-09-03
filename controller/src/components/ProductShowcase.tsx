interface ProductShowcaseProps {
  onOpenSoftware: () => void;
  onOpenShop: () => void;
}

const stories = [
  {
    image: "/assets/home-backyard-track.jfif",
    alt: "Backyard dirt racing track",
    caption: "Turn your backyard track into raceday",
  },
  {
    image: "/assets/home-professional-track.jfif",
    alt: "Prepared dirt oval track",
    caption: "If you can tag it, you can race it",
  },
  {
    image: "/assets/home-tag-it-race-it.jfif",
    alt: "Racers driving go-karts on a backyard track",
    caption: "Built for fun. Made to compete",
  },
  {
    image: "/assets/home-built-for-fun.jfif",
    alt: "Two backyard racers celebrating",
    caption: "Timing, control, and results in one system",
  },
];

export function ProductShowcase({ onOpenSoftware, onOpenShop }: ProductShowcaseProps) {
  return (
    <section className="product-shell storefront-home">
      <header className="storefront-intro">
        <p className="eyebrow">Complex Control</p>
        <h1>One system for all your racing needs</h1>
        <p>
          A user-friendly transponder timing and race management system for racers and track operators.
          Run races, record RFID crossings, and see results from a phone, tablet, or desktop.
        </p>
        <div className="storefront-actions">
          <button className="primary-button" onClick={onOpenSoftware}>Let's go racing</button>
          <button className="secondary-button" onClick={onOpenShop}>Shop now</button>
        </div>
      </header>

      <div className="storefront-story" aria-label="Complex Control in action">
        {stories.map((story, index) => (
          <figure className={index === 0 ? "storefront-story-featured" : ""} key={story.image}>
            <img src={story.image} alt={story.alt} />
            <figcaption>{story.caption}</figcaption>
          </figure>
        ))}
      </div>

      <div className="product-list" aria-label="Complex Control product components">
        <article>
          <span>01</span>
          <h2>RFID reader</h2>
          <p>Detects registered tags at the timing line.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Trackside controller</h2>
          <p>Receives and records crossings locally, even without internet.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Race software</h2>
          <p>Handles racers, flags, laps, schedules, and results.</p>
        </article>
      </div>
    </section>
  );
}
