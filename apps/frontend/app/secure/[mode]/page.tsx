export default function ModePage({ params }: { params: { mode: string } }) {
    return (
        <div className="flex items-center justify-center size-full">
            <h1 className="text-2xl font-semibold text-muted-foreground">
                {params.mode.charAt(0).toUpperCase() + params.mode.slice(1)} Dashboard
            </h1>
        </div>
    );
}
