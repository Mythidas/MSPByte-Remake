import { Spinner } from "@/components/Spinner";

export default function Loader() {
  return (
    <div className="flex flex-col w-full h-[50vh] justify-center items-center">
      <Spinner size={48} />
    </div>
  );
}
