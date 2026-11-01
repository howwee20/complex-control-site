interface ProductShowcaseProps {
  onOpenSoftware: () => void;
  onOpenShop: () => void;
  onConnect: () => void;
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

export function ProductShowcase({ onOpenSoftware, onOpenShop, onConnect }: ProductShowcaseProps) {
  return (
    <section className="product-shell jake-home">
      <p className="jake-home-intro">
        RFID timing and race management for your track. Register racers, run events, and follow live results from a phone or computer. Racing and saved results stay on your controller, even without internet.
      </p>
      <div className="home-actions">
        <button className="primary-button" onClick={onConnect}>Connect controller</button>
        <button className="secondary-button" onClick={onOpenSoftware}>Try the demo</button>
      </div>

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
