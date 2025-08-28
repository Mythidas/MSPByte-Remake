'use server';

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 size-full">
      <div className="p-4">
        <div className="flex flex-col h-full px-8 py-12 justify-between bg-linear-to-t from-primary/15 to-card rounded shadow">
          <strong className="text-2xl">MSP Byte</strong>
          <strong className="text-5xl">Bite sized view of your data.</strong>
        </div>
      </div>
      <div className="flex size-full items-center justify-center">{children}</div>
    </div>
  );
}
