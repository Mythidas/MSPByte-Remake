import { useEffect, useMemo, useState } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form.tsx";
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@workspace/ui/components/input.tsx";
import { Textarea } from "@workspace/ui/components/textarea.tsx";
import { SubmitButton } from "@workspace/ui/components/SubmitButton.tsx";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select.tsx";
import { Button } from "@workspace/ui/components/button.tsx";
import {
  chooseImageDialog,
  readFileBase64,
  takeScreenshot,
} from "@/lib/file.ts";
import { listen } from "@tauri-apps/api/event";
import { fetch } from "@tauri-apps/plugin-http";
import { Spinner } from "@workspace/ui/components/Spinner.tsx";
import { getSettings } from "@/lib/agent.ts";
import { getRegistryValue } from "@/lib/registry.ts";
import { APIResponse } from "@workspace/shared/types/api.ts";
import { hideWindow, showWindow } from "@/lib/window.ts";

const phoneSchema = z
  .string()
  .min(1, "Phone # is required")
  .refine(
    (val) => {
      // Remove everything that's not a digit
      const digits = val.replace(/\D/g, "");
      return digits.length === 10;
    },
    {
      message: "Phone number must be 10 digits",
    }
  );

const formSchema = z.object({
  summary: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  impact: z.string(),
  urgency: z.string(),

  name: z.string().min(1, "Name is required"),
  email: z.email().min(1, "Email is required"),
  phone: phoneSchema,

  screenshot: z.string().optional(),
  screenshot_url: z.string().optional(),
  screenshot_blob: z.string().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export default function Support() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      summary: "",
      description: "",
      impact: "3",
      urgency: "3",

      name: "",
      email: "",
      phone: "",

      screenshot: undefined,
      screenshot_url: undefined,
      screenshot_blob: undefined,
    },
  });
  const formValues = form.watch();

  useEffect(() => {
    const usePromise = listen("use_screenshot", async (path) => {
      try {
        form.setValue("screenshot", path.payload as string);
      } catch (err) {
        toast.error("Failed to get screenshot");
      }
    });

    return () => {
      usePromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const unlistenPromise = listen("on_hide", async () => {
      form.reset();
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Process screenshot changes when path changes
  useEffect(() => {
    if (formValues.screenshot) {
      (async () => {
        const { data: base64 } = await readFileBase64(formValues.screenshot!);

        if (base64) {
          form.setValue("screenshot_url", `data:image/png;base64,${base64}`);
          form.setValue("screenshot_blob", base64);
        } else {
          toast.error("Failed to process file");
          form.setValue("screenshot_url", undefined);
          form.setValue("screenshot_blob", undefined);
        }
      })();
    } else {
      // reset when screenshot is cleared
      form.setValue("screenshot_url", undefined);
      form.setValue("screenshot_blob", undefined);
    }
  }, [formValues.screenshot]);

  // Derived object for UI rendering
  const screenshot = useMemo(() => {
    if (!formValues.screenshot) return undefined;

    const name = formValues.screenshot.includes("/")
      ? formValues.screenshot.split("/").pop()
      : formValues.screenshot.split("\\").pop();

    return {
      name,
      url: formValues.screenshot_url ?? "",
      data: formValues.screenshot_blob ?? null,
    };
  }, [
    formValues.screenshot,
    formValues.screenshot_url,
    formValues.screenshot_blob,
  ]);

  const onSubmit = async (formData: FormSchema) => {
    setIsSubmitting(true);

    try {
      const { data: settings } = await getSettings();
      if (
        !settings ||
        !settings.device_id ||
        !settings.site_id ||
        !settings.api_host
      ) {
        throw "Invalid settings. Please restart agent.";
      }
      const rmmId = await getRegistryValue("SOFTWARE\\CentraStage", "DeviceID");

      const res = await fetch(`${settings.api_host}/v1.0/ticket/create`, {
        method: "POST",
        headers: {
          "X-Site-ID": settings.site_id,
          "X-Device-ID": settings.device_id,
        },
        body: JSON.stringify({
          ...formData,
          screenshot_url: undefined,
          screenshot_blob: undefined,

          screenshot: {
            ...screenshot,
            url: undefined,
          },
          rmm_id: rmmId.data,
        }),
      });

      if (!res.ok) {
        throw "API Fetch Error";
      }
      const ret: APIResponse<string> = await res.json();

      alert(`Support ticket created successfully! Ticket ID: ${ret.data}`);
      form.reset();
      await hideWindow("support");
    } catch (err) {
      toast.error(`Failed to submit ticket: ${err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = async () => {
    const { data: path } = await chooseImageDialog();
    if (!path) {
      toast.info("No file was chosen or found");
      return;
    }

    form.setValue("screenshot", path);
  };

  const handleScreenshot = async () => {
    const { data: path } = await takeScreenshot();
    await showWindow("support");
    form.setValue("screenshot", path);
  };

  return (
    <main className="flex flex-col size-full p-6 gap-2 items-center">
      <h1 className="flex text-4xl text-center items-center">
        <span className="text-6xl text-primary">Centriserve IT</span>
      </h1>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4 size-full"
        >
          <FormField
            control={form.control}
            name="summary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Ticket title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us about the issue"
                    className="h-20 resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-2 w-full">
            <FormField
              control={form.control}
              name="urgency"
              render={({ field }) => (
                <FormItem className="flex flex-col w-full">
                  <FormLabel>How urgent is your request?</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select urgency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">Low</SelectItem>
                        <SelectItem value="2">Medium</SelectItem>
                        <SelectItem value="1">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="impact"
              render={({ field }) => (
                <FormItem className="flex flex-col w-full">
                  <FormLabel>How urgent is your request?</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select urgency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">Only Me</SelectItem>
                        <SelectItem value="2">Mutliple Users</SelectItem>
                        <SelectItem value="1">Company Wide</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-8 gap-2 w-full">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="col-span-3">
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="col-span-3">
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="john.doe@gmail.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="123-123-1234" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex flex-col w-full gap-2">
            <FormLabel>Screenshot (Optional)</FormLabel>
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleFileSelect}
                disabled={isSubmitting}
                className="w-1/2"
              >
                {screenshot ? screenshot.name : "Choose Image"}
              </Button>
              {!!screenshot ? (
                <Button
                  variant="destructive"
                  onClick={() => form.setValue("screenshot", undefined)}
                >
                  Clear Screenshot
                </Button>
              ) : (
                <Button type="button" onClick={handleScreenshot}>
                  Take Screenshot
                </Button>
              )}
            </div>

            {screenshot && (
              <div className="border rounded p-2 w-fit overflow-clip">
                <img
                  src={screenshot.url}
                  alt="Screenshot preview"
                  className="w-full h-52 object-contain"
                />
              </div>
            )}
          </div>

          <div className="flex w-full mt-auto">
            <SubmitButton pending={isSubmitting}>Submit Ticket</SubmitButton>
          </div>
        </form>
      </Form>
    </main>
  );
}
