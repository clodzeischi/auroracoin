/**
 * The sky behind every screen: a handful of boxy pixel clouds drifting
 * right at three depths. Placement (top/delay) lives here as data rather
 * than in styles.css because it is one-off scatter, not a reusable rule -
 * the shape and the size/speed pairing that actually reads as parallax are
 * the CSS's job. Negative animation-delay starts each cloud mid-drift, so
 * the sky is already scattered on first paint instead of queued at the
 * left edge.
 */
const CLOUDS = [
    { shape: 'a', depth: 'far', top: '4%', delay: '-22s' },
    { shape: 'b', depth: 'mid', top: '14%', delay: '-55s' },
    { shape: 'a', depth: 'near', top: '8%', delay: '-8s' },
    { shape: 'b', depth: 'far', top: '30%', delay: '-90s' },
    { shape: 'a', depth: 'mid', top: '38%', delay: '-25s' },
    { shape: 'b', depth: 'near', top: '22%', delay: '-38s' },
];

export const CloudField = () => (
    <div className="cloud-field" aria-hidden="true">
        {CLOUDS.map(({ shape, depth, top, delay }, index) => (
            <div
                key={index}
                className={`cloud cloud-${shape} is-${depth}`}
                style={{ top, animationDelay: delay }}
            />
        ))}
    </div>
);
