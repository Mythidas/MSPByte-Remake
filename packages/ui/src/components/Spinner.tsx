export function Spinner({
    size = 24,
    className = "",
}: {
    size?: number;
    className?: string;
}) {
    return (
        <div
            className={`animate-spin rounded-full border-2 border-border border-t-transparent ${className}`}
            style={{ width: size, height: size }}
        />
    );
}
