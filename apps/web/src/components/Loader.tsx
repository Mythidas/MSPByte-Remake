import { Spinner } from "@/components/Spinner";

export default function Loader() {
  return (
    <div className="flex gap-2  size-full justify-center items-center">
      <Spinner />
      <span>Loading</span>
    </div>
  );
}
