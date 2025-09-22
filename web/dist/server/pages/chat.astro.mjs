import { e as createComponent, k as renderComponent, r as renderTemplate } from '../chunks/astro/server_C3VUefGl.mjs';
import 'kleur/colors';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectGroup, e as SelectLabel, f as SelectItem, g as cn, B as Button } from '../chunks/select_DW06wDgX.mjs';
import { useChat } from '@ai-sdk/react';
import { EyeIcon, EyeOffIcon, CogIcon, CommandIcon, CornerDownRightIcon, InfoIcon } from 'lucide-react';
import { forwardRef, useState, useEffect, useRef, startTransition } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { $ as $$Base } from '../chunks/base_uF4SXvUR.mjs';
export { renderers } from '../renderers.mjs';

const availableModels = {
  OpenAI: ["gpt-4.1", "gpt-4.1-mini"],
  Google: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"]
};
function ModelSelector({
  availableProviders,
  onModelChange,
  initialModel
}) {
  return /* @__PURE__ */ jsxs(
    Select,
    {
      onValueChange: (value) => {
        const [provider, model] = value.split(":");
        onModelChange({
          provider,
          model
        });
      },
      defaultValue: initialModel ? `${initialModel.provider.toLowerCase()}:${initialModel.model}` : "",
      children: [
        /* @__PURE__ */ jsx(SelectTrigger, { className: "p-1 px-2 text-xs h-auto", children: /* @__PURE__ */ jsx(SelectValue, { placeholder: "modelo" }) }),
        /* @__PURE__ */ jsx(SelectContent, { children: Object.entries(availableModels).filter(
          ([provider]) => availableProviders.includes(
            provider.toLowerCase()
          )
        ).map(([provider, models]) => /* @__PURE__ */ jsxs(SelectGroup, { children: [
          /* @__PURE__ */ jsx(SelectLabel, { className: "text-normal font-semibold", children: provider }),
          models.map((model) => /* @__PURE__ */ jsx(
            SelectItem,
            {
              className: "text-xs",
              value: `${provider.toLowerCase()}:${model}`,
              children: model
            },
            model
          ))
        ] }, provider)) })
      ]
    }
  );
}

function Input({ className, type, ...props }) {
  return /* @__PURE__ */ jsx(
    "input",
    {
      type,
      "data-slot": "input",
      className: cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      ),
      ...props
    }
  );
}

const PasswordInput = forwardRef(({ initialValue, placeholder }, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  return /* @__PURE__ */ jsxs("div", { className: "flex gap-1", children: [
    /* @__PURE__ */ jsx(
      Input,
      {
        ref,
        defaultValue: initialValue,
        type: showPassword ? "text" : "password",
        autoComplete: "existing-password",
        placeholder
      }
    ),
    /* @__PURE__ */ jsx(Button, { variant: "ghost", onClick: () => setShowPassword((prev) => !prev), children: showPassword ? /* @__PURE__ */ jsx(EyeIcon, {}) : /* @__PURE__ */ jsx(EyeOffIcon, {}) })
  ] });
});

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive: "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);
function Badge({
  className,
  variant,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "span";
  return /* @__PURE__ */ jsx(
    Comp,
    {
      "data-slot": "badge",
      className: cn(badgeVariants({ variant }), className),
      ...props
    }
  );
}

function Textarea({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "textarea",
    {
      "data-slot": "textarea",
      className: cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      ),
      ...props
    }
  );
}

function ScrollArea({
  className,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs(
    ScrollAreaPrimitive.Root,
    {
      "data-slot": "scroll-area",
      className: cn("relative", className),
      ...props,
      children: [
        /* @__PURE__ */ jsx(
          ScrollAreaPrimitive.Viewport,
          {
            "data-slot": "scroll-area-viewport",
            className: "focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1",
            children
          }
        ),
        /* @__PURE__ */ jsx(ScrollBar, {}),
        /* @__PURE__ */ jsx(ScrollAreaPrimitive.Corner, {})
      ]
    }
  );
}
function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}) {
  return /* @__PURE__ */ jsx(
    ScrollAreaPrimitive.ScrollAreaScrollbar,
    {
      "data-slot": "scroll-area-scrollbar",
      orientation,
      className: cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsx(
        ScrollAreaPrimitive.ScrollAreaThumb,
        {
          "data-slot": "scroll-area-thumb",
          className: "bg-border relative flex-1 rounded-full"
        }
      )
    }
  );
}

function ConfigForm({
  initialKeys,
  onSetKeys
}) {
  const [showInfo, setShowInfo] = useState(false);
  const openAIKeyRef = useRef(null);
  const geminiKeyRef = useRef(null);
  return /* @__PURE__ */ jsxs("div", { className: "flex gap-2 items-end", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2 flex-1", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 text-sm items-center", children: [
        "Defina suas chaves de API aqui.",
        /* @__PURE__ */ jsx(
          Button,
          {
            className: "py-1 !px-1 h-auto",
            variant: showInfo ? "default" : "ghost",
            onClick: () => setShowInfo((prev) => !prev),
            children: /* @__PURE__ */ jsx(InfoIcon, {})
          }
        )
      ] }),
      showInfo && /* @__PURE__ */ jsx("div", { className: "bg-slate-800 rounded-md p-2 text-white text-sm self-start", children: "Uma chave de API é necessária para usar o chat. Elas são armazenadas apenas no seu navegador." }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 text-sm items-center", children: [
        /* @__PURE__ */ jsx("b", { children: "OpenAI" }),
        " ",
        /* @__PURE__ */ jsxs("i", { children: [
          "Obtenha uma em",
          " ",
          /* @__PURE__ */ jsx(
            "a",
            {
              className: "hover:underline text-black",
              href: "https://platform.openai.com/api-keys",
              target: "_blank",
              rel: "noopener noreferrer",
              children: "https://platform.openai.com/api-keys"
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        PasswordInput,
        {
          ref: openAIKeyRef,
          initialValue: initialKeys.openAIKey,
          placeholder: "Chave de API OpenAI"
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 text-sm items-center", children: [
        /* @__PURE__ */ jsx("b", { children: "Google Gemini" }),
        " ",
        /* @__PURE__ */ jsxs("i", { children: [
          "Obtenha uma em",
          " ",
          /* @__PURE__ */ jsx(
            "a",
            {
              className: "hover:underline text-black",
              href: "https://aistudio.google.com/app/apikey",
              target: "_blank",
              rel: "noopener noreferrer",
              children: "https://aistudio.google.com/app/apikey"
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        PasswordInput,
        {
          ref: geminiKeyRef,
          initialValue: initialKeys.geminiKey,
          placeholder: "Chave de API Google Gemini"
        }
      )
    ] }),
    /* @__PURE__ */ jsx(
      Button,
      {
        type: "button",
        onClick: () => onSetKeys({
          openAIKey: openAIKeyRef.current?.value ?? "",
          geminiKey: geminiKeyRef.current?.value ?? ""
        }),
        children: "OK"
      }
    )
  ] });
}
function ChatBubble({
  align,
  children
}) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: cn(
        "rounded-lg py-2 px-4 bg-slate-200 flex flex-col gap-2",
        align === "left" ? "mr-24" : "ml-24"
      ),
      children
    }
  );
}
function ToolCall({
  toolCall
}) {
  {
    const [showDetails, setShowDetails] = useState(false);
    const toggleDetails = () => {
      startTransition(() => {
        setShowDetails((prev) => !prev);
      });
    };
    const results = toolCall.result?.content;
    const waiting = toolCall.state !== "result";
    return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs(
      "div",
      {
        className: cn(
          "flex flex-col gap-2 max-w-full",
          showDetails && "w-full"
        ),
        children: [
          /* @__PURE__ */ jsx("div", { className: "flex", onClick: toggleDetails, children: /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              Badge,
              {
                className: cn(
                  "text-xs cursor-default",
                  waiting && "animate-pulse",
                  results?.length > 0 && "rounded-e-none"
                ),
                title: JSON.stringify(toolCall.args),
                children: toolCall.toolName
              }
            ),
            results?.length > 0 && /* @__PURE__ */ jsx(
              Badge,
              {
                className: "text-xs cursor-default bg-slate-50 text-slate-800 rounded-s-none",
                title: results.map((content) => content?.text).join("\n"),
                children: results.length
              }
            )
          ] }) }),
          showDetails && /* @__PURE__ */ jsxs("div", { className: "flex gap-1 justify-between", children: [
            /* @__PURE__ */ jsx(ScrollArea, { className: "rounded-md border-slate-300 border p-2 text-xs bg-slate-800 text-white w-full max-h-32 overflow-y-auto", children: /* @__PURE__ */ jsx("pre", { className: "whitespace-pre-wrap break-all", children: JSON.stringify(toolCall.args, null, 2) }) }),
            /* @__PURE__ */ jsx(ScrollArea, { className: "rounded-md border-slate-300 border p-2 text-xs bg-slate-800 text-white w-full max-h-32 overflow-y-auto", children: toolCall.result?.content?.map(({ text }) => {
              try {
                const json = JSON.parse(text);
                return /* @__PURE__ */ jsx("pre", { className: "whitespace-pre-wrap break-all", children: JSON.stringify(json, null, 2) });
              } catch (e) {
                return text;
              }
            }) })
          ] })
        ]
      }
    ) });
  }
}
function ReasoningPart({ part }) {
  const [showDetails, setShowDetails] = useState(false);
  const toggleDetails = () => {
    startTransition(() => {
      setShowDetails((prev) => !prev);
    });
  };
  return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn(
        "flex flex-col gap-2 max-w-full",
        showDetails && "w-full"
      ),
      children: [
        /* @__PURE__ */ jsx("div", { className: "flex", onClick: toggleDetails, children: /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx(
          Badge,
          {
            className: cn(
              "text-xs cursor-pointer",
              showDetails ? "bg-slate-800 text-white" : "",
              "inline-flex items-center"
            ),
            title: "Raciocínio do modelo",
            children: "Raciocínio"
          }
        ) }) }),
        showDetails && /* @__PURE__ */ jsx(ScrollArea, { className: "prose prose-p:my-0 prose-td:py-0 prose-custom-code rounded-md border border-slate-300 p-2 text-xs bg-slate-100 text-black w-full max-h-32 overflow-y-auto max-w-none flex flex-col-reverse", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
          part.details && part.details.length > 0 ? part.details.map((detail, i) => /* @__PURE__ */ jsx(Markdown, { remarkPlugins: [remarkGfm], children: detail.type === "text" ? detail.text : detail.data }, i)) : null,
          part.reasoning && /* @__PURE__ */ jsx(Markdown, { remarkPlugins: [remarkGfm], children: part.reasoning })
        ] }) })
      ]
    }
  ) });
}
function Chat() {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [localConfigLoaded, setLocalConfigLoaded] = useState(false);
  const [apiKeys, setApiKeys] = useState({
    openAIKey: "",
    geminiKey: ""
  });
  const [selectedModel, setSelectedModel] = useState(null);
  useEffect(() => {
    if (!localConfigLoaded) {
      const _apiKeys = localStorage.getItem("apiKeys");
      if (_apiKeys) {
        setApiKeys(JSON.parse(_apiKeys));
      }
      const _selectedModel = localStorage.getItem("model");
      if (_selectedModel) {
        setSelectedModel(JSON.parse(_selectedModel));
      } else {
        setSelectedModel({ provider: "openai", model: "gpt-4o-mini" });
      }
      setLocalConfigLoaded(true);
    } else {
      localStorage.setItem("apiKeys", JSON.stringify(apiKeys));
      localStorage.setItem("model", JSON.stringify(selectedModel));
    }
  }, [apiKeys, selectedModel, localConfigLoaded]);
  const hasApiKey = apiKeys.openAIKey !== "" || apiKeys.geminiKey !== "";
  const apiKey = selectedModel?.provider === "openai" ? apiKeys.openAIKey : apiKeys.geminiKey;
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    error,
    reload,
    status,
    stop,
    setMessages
  } = useChat({
    api: "/api/chat",
    body: { apiKey, model: selectedModel }
  });
  useEffect(() => {
    if (status === "ready") {
      const lastMessage = messages.at(-1);
      if (lastMessage?.role === "assistant" && lastMessage?.content === "") {
        setMessages(messages.slice(0, -1));
      }
    }
  }, [status, messages]);
  const isMac = typeof window !== "undefined" && (window.navigator?.userAgent?.includes("Mac") || window.navigator?.userAgent?.includes("iPad"));
  return /* @__PURE__ */ jsxs("div", { className: "py-4 mx-auto max-w-screen-lg flex flex-col h-screen gap-4", children: [
    /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto flex flex-col-reverse", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
      messages.map((message, index) => {
        const toolInvocationParts = message.parts.filter(
          (part) => part.type === "tool-invocation"
        );
        const isLastMessage = index === messages.length - 1;
        const isLoading = status === "streaming" && isLastMessage;
        return /* @__PURE__ */ jsxs(
          ChatBubble,
          {
            align: message.role === "user" ? "right" : "left",
            children: [
              toolInvocationParts.length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
                toolInvocationParts.map((part, index2) => /* @__PURE__ */ jsx(ToolCall, { toolCall: part.toolInvocation }, index2)),
                message.parts.filter((part) => part.type === "reasoning").map((part, i) => /* @__PURE__ */ jsx(
                  ReasoningPart,
                  {
                    part
                  },
                  `reasoning-badge-${i}`
                ))
              ] }),
              message.parts.map((part, index2) => {
                if (part.type === "text") {
                  return /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: "prose prose-td:py-0 prose-custom-code max-w-full",
                      children: /* @__PURE__ */ jsx(Markdown, { remarkPlugins: [remarkGfm], children: part.text })
                    },
                    index2
                  );
                }
                return null;
              }),
              isLoading && /* @__PURE__ */ jsx("div", { className: "animate-pulse self-start", children: "..." })
            ]
          },
          message.id
        );
      }),
      status === "submitted" && /* @__PURE__ */ jsx(ChatBubble, { align: "left", children: /* @__PURE__ */ jsx("div", { className: "animate-pulse", children: "..." }) })
    ] }) }),
    error && /* @__PURE__ */ jsxs("div", { className: "flex gap-2 items-center", children: [
      /* @__PURE__ */ jsx("div", { children: "Ocorreu um erro." }),
      /* @__PURE__ */ jsx(Button, { type: "button", onClick: () => reload(), variant: "outline", children: "Tentar novamente" })
    ] }),
    /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "flex gap-2 items-end", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative w-full mt-8", children: [
        localConfigLoaded && (isConfiguring || !hasApiKey) ? /* @__PURE__ */ jsx(
          ConfigForm,
          {
            initialKeys: apiKeys,
            onSetKeys: (keys) => {
              setApiKeys(keys);
              setIsConfiguring(false);
            }
          }
        ) : /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          localConfigLoaded && /* @__PURE__ */ jsx("div", { className: "absolute bottom-full left-0 mb-2", children: /* @__PURE__ */ jsx(
            ModelSelector,
            {
              availableProviders: ["openai", "google"],
              onModelChange: (model) => {
                setSelectedModel(model);
              },
              initialModel: selectedModel ?? void 0
            }
          ) }),
          /* @__PURE__ */ jsx(
            Textarea,
            {
              value: input,
              onKeyDown: (e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              },
              onChange: handleInputChange,
              disabled: error != null || status === "streaming",
              className: "field-sizing-content min-h-20 border-slate-400"
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { className: "absolute right-full mr-2 bottom-0 flex flex-col gap-0 items-center", children: /* @__PURE__ */ jsx(
          Button,
          {
            variant: isConfiguring || !hasApiKey ? "default" : "ghost",
            disabled: !hasApiKey,
            onClick: () => {
              if (hasApiKey) {
                setIsConfiguring((prev) => !prev);
              }
            },
            children: /* @__PURE__ */ jsx(CogIcon, {})
          }
        ) })
      ] }),
      !isConfiguring && apiKey && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2 justify-end", children: [
        status === "streaming" && /* @__PURE__ */ jsx(Button, { type: "button", onClick: () => stop(), variant: "outline", children: "Stop" }),
        /* @__PURE__ */ jsx(
          Button,
          {
            type: "submit",
            disabled: !input || error != null || status === "streaming" || status === "submitted",
            children: /* @__PURE__ */ jsxs("div", { className: "flex gap-2 items-center", children: [
              /* @__PURE__ */ jsx("span", { children: isMac ? /* @__PURE__ */ jsx(CommandIcon, {}) : "Ctrl" }),
              /* @__PURE__ */ jsx(CornerDownRightIcon, { className: "-rotate-90" })
            ] })
          }
        )
      ] })
    ] })
  ] });
}

const $$Chat = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Base, {}, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "ChatComponent", Chat, { "client:idle": true, "client:component-hydration": "idle", "client:component-path": "F:/git/DarwinCoreJSON/web/src/components/Chat.tsx", "client:component-export": "default" })} ` })}`;
}, "F:/git/DarwinCoreJSON/web/src/pages/chat.astro", void 0);

const $$file = "F:/git/DarwinCoreJSON/web/src/pages/chat.astro";
const $$url = "/chat";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Chat,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
