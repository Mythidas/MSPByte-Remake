import { Doc } from "@/lib/api";

type Props = {
    children: React.ReactNode;
    modes: Doc<'integrations'>[];
}

export default function AppProvider({ children }: Props) {


    return children;
}
