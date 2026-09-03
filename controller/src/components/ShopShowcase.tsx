interface ShopShowcaseProps {
  onOpenSoftware: () => void;
}

const products = [
  {
    name: "Complex Control timing system",
    description: "Race timing, RFID tags, race control, and results in one trackside kit.",
    image: "/assets/home-backyard-track.jfif",
  },
  {
    name: "Integrated traffic lights",
    description: "Add red, yellow, and green track lights with the simple plug-in system.",
    image: "/assets/home-professional-track.jfif",
  },
  {
    name: "Lap display",
    description: "Give racers and spectators a clear view of the current lap and race status.",
    image: "/assets/home-tag-it-race-it.jfif",
  },
];

export function ShopShowcase({ onOpenSoftware }: ShopShowcaseProps) {
  return (
    <section className="shop-shell">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Complex Control</p>
          <h2>Shop</h2>
          <p className="section-copy">Build a complete timing and race-control system.</p>
        </div>
      </header>
      <div className="shop-grid">
        {products.map((product) => (
          <article key={product.name}>
            <img src={product.image} alt="" />
            <div>
              <h3>{product.name}</h3>
              <p>{product.description}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="storefront-actions shop-actions">
        <button className="primary-button" onClick={onOpenSoftware}>Open race control</button>
      </div>
    </section>
  );
}
