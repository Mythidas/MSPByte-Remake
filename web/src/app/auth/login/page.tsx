"use client";

import { login, loginWithAzure } from "@/lib/actions/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FaMicrosoft } from "react-icons/fa";
import { toast } from "sonner";
import z from "zod";

const formSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof formSchema>;

export default function Page() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true);

      const result = await login(data.email, data.password);
      if (result.error) {
        throw result.error.message;
      }

      router.push("/");
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : (err as { message: string })?.message || "Unknown error";
      toast.error(`Failed to Login: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  const ssoLoginAzure = async () => {
    try {
      setIsLoading(true);

      const result = await loginWithAzure();
      if (result.error) throw result.error.message;

      window.location.href = result.data;
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : (err as { message: string })?.message || "Unknown error";
      toast.error(`Failed to Login: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form
        className="w-full h-full flex items-center justify-center"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <Card className="w-2/3 h-fit">
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Welcome Back to MSP Byte!</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="john.doe@email.com"
                      disabled
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="*****"
                      type="password"
                      disabled
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button disabled className="w-full">
              Login
              <LogIn />
            </Button>
            <div className="flex gap-2 items-center w-full justify-center overflow-clip">
              <Separator />
              <span className="w-fit">OR</span>
              <Separator />
            </div>
            <div className="grid grid-cols-1">
              <AuthIcon onClick={ssoLoginAzure} disabled={isLoading}>
                <FaMicrosoft />
              </AuthIcon>
            </div>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}

function AuthIcon({
  children,
  ...props
}: { children: React.ReactNode } & React.ComponentProps<typeof Button>) {
  return (
    <Button variant="secondary" {...props}>
      {children}
    </Button>
  );
}
