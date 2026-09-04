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
    caption: "",
  },
];

export function ProductShowcase({ onOpenSoftware, onOpenShop }: ProductShowcaseProps) {
  return (
    <section className="product-shell jake-home">
      <h1 className="jake-home-headline">
        <span>Complex Control</span>
        <span>Multi-platform Transponder Racing</span>
        <span>At a Competitive Price</span>
      </h1>

      <p className="jake-home-intro">
        <strong>
          Complex Control is a user-friendly transponder timing and race management system built for racers and track operators.
          Designed to be cost-effective without sacrificing features, it delivers the tools needed to run and manage races on a
          desktop or mobile device. Explore the{" "}
          <button type="button" onClick={onOpenSoftware}>Simulator Mode</button> to experience the system and see how it works before you buy.
        </strong>
      </p>

      <div className="jake-home-story" aria-label="Complex Control in action">
        {stories.map((story) => (
          <figure key={story.image}>
            <img src={story.image} alt={story.alt} />
            {story.caption && <figcaption>{story.caption}</figcaption>}
          </figure>
        ))}
      </div>

      <button className="primary-button jake-home-shop" onClick={onOpenShop}>Shop now</button>
    </section>
  );
}
