import React, { memo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { CopyIcon, CheckIcon } from "lucide-react";
import { useTheme } from "next-themes";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { sanitizeMarkdownContent } from "@/lib/content-sanitizer";

type CodeComponentProps = React.ComponentPropsWithoutRef<"code"> & {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

export const CodeComponent: React.FC<CodeComponentProps> = ({
  inline,
  className,
  children,
  ...props
}) => {
  const match = /language-(\w+)/.exec(className || "");
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  if (inline) {
    return (
      <code
        className="text-xs bg-muted border border-border py-0.5 px-1.5 rounded font-mono"
        style={{ wordBreak: "break-all" }}
        {...props}
      >
        {children}
      </code>
    );
  }

  // Code block with language
  if (match) {
    return (
      <div className="border rounded-lg bg-muted/30 my-2 overflow-hidden">
        <div className="flex items-center justify-between bg-muted px-3 py-2 border-b">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{match[1]}</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              navigator.clipboard.writeText(String(children));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? (
              <CheckIcon className="w-4 h-4 text-green-500" />
            ) : (
              <CopyIcon className="w-4 h-4" />
            )}
          </Button>
        </div>
        <ScrollArea className="max-w-full">
          <div className="px-4 py-2" style={{ maxWidth: "100%" }}>
            <SyntaxHighlighter
              language={match[1]}
              style={theme === "dark" ? oneDark : oneLight}
              customStyle={{
                fontSize: "12.5px",
                backgroundColor: "transparent",
                padding: "0",
                margin: "0",
                background: "none",
                overflow: "visible",
              }}
              wrapLongLines={true}
              PreTag="div"
              codeTagProps={{
                style: {
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  overflowWrap: "anywhere",
                },
              }}
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Code block without language
  return (
    <code
      className="relative rounded !bg-sidebar border border-muted-foreground/20 px-[0.3rem] py-[0.2rem] font-mono text-xs"
      style={{ wordBreak: "break-all" }}
    >
      {children}
    </code>
  );
};

const components: Partial<Components> = {
  code: CodeComponent,
  pre: ({ children }) => <>{children}</>,
  ol: ({ children, ...props }) => (
    <ol className="list-decimal list-outside ml-5 mb-2 mt-1 space-y-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm leading-relaxed pl-1" {...props}>
      {children}
    </li>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc list-outside ml-5 mb-2 mt-1 space-y-1" {...props}>
      {children}
    </ul>
  ),
  strong: ({ children, ...props }) => (
    <span className="font-semibold text-foreground" {...props}>
      {children}
    </span>
  ),
  em: ({ children, ...props }) => (
    <span className="italic text-foreground" {...props}>
      {children}
    </span>
  ),
  p: ({ children, ...props }) => (
    <p
      className="mb-2 text-sm leading-relaxed text-foreground last:mb-0"
      style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
      {...props}
    >
      {children}
    </p>
  ),
  a: ({ children, href, ...props }) => {
    // Check if the URL is external (starts with http/https) or internal
    const isExternal = href?.startsWith("http") || href?.startsWith("https");

    if (isExternal) {
      return (
        <a
          className="text-blue-500 hover:underline"
          style={{
            wordBreak: "break-all",
            maxWidth: "100%",
            display: "inline-block",
            textOverflow: "ellipsis",
          }}
          href={href}
          target="_blank"
          rel="noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    }

    return (
      <Link
        passHref
        className="text-blue-500 hover:underline"
        style={{
          wordBreak: "break-all",
          maxWidth: "100%",
          display: "inline-block",
          textOverflow: "ellipsis",
        }}
        href={href || "#"}
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </Link>
    );
  },
  h1: ({ children, ...props }) => (
    <h1
      className="text-xl font-semibold mt-3 mb-2 text-foreground first:mt-0"
      style={{ wordBreak: "break-word" }}
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="text-lg font-semibold mt-3 mb-1.5 text-foreground first:mt-0"
      style={{ wordBreak: "break-word" }}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="text-base font-semibold mt-2.5 mb-1.5 text-foreground first:mt-0"
      style={{ wordBreak: "break-word" }}
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4
      className="text-sm font-semibold mt-2 mb-1 text-foreground"
      style={{ wordBreak: "break-word" }}
      {...props}
    >
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5
      className="text-sm font-medium mt-1.5 mb-1 text-foreground"
      style={{ wordBreak: "break-word" }}
      {...props}
    >
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6
      className="text-xs font-medium mt-1.5 mb-1 text-muted-foreground uppercase tracking-wide"
      style={{ wordBreak: "break-word" }}
      {...props}
    >
      {children}
    </h6>
  ),
  img: ({ alt, src, title, ...props }) => (
    <img
      className="max-w-full h-auto my-2 rounded"
      alt={alt}
      src={src}
      title={title}
      {...props}
    />
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-l-3 border-muted-foreground/30 pl-4 italic my-2 text-muted-foreground bg-muted/30 py-2 rounded-r-md"
      style={{ wordBreak: "break-word" }}
      {...props}
    >
      {children}
    </blockquote>
  ),
  table: ({ children, ...props }) => (
    <ScrollArea className="w-140 border rounded-lg my-2">
      <Table className="w-full" {...props}>
        {children}
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
  thead: ({ children, ...props }) => (
    <TableHeader {...props}>{children}</TableHeader>
  ),
  tbody: ({ children, ...props }) => (
    <TableBody {...props}>{children}</TableBody>
  ),
  tfoot: ({ children, ...props }) => (
    <TableFooter {...props}>{children}</TableFooter>
  ),
  tr: ({ children, ...props }) => <TableRow {...props}>{children}</TableRow>,
  th: ({ children, ...props }) => <TableHead {...props}>{children}</TableHead>,
  td: ({ children, ...props }) => <TableCell {...props}>{children}</TableCell>,
  hr: () => <Separator className="my-2" />,
};

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeRaw];



// Function to process citations and convert them to proper format
const processCitations = (
  content: string,
  repoUrl?: string,
  branch?: string
): string => {
  // First sanitize the content using the centralized sanitizer
  const sanitizedContent = sanitizeMarkdownContent(content);

  // Match citations in format 【F:filename†L1-L1】
  const citationRegex = /【F:([^†]+)†L(\d+)-L(\d+)】/g;

  return sanitizedContent.replace(
    citationRegex,
    (match, filename, startLine, endLine) => {
      const displayText =
        startLine === endLine
          ? `${filename}:${startLine}`
          : `${filename}:${startLine}-${endLine}`;

      const repoBaseUrl = repoUrl ? `${repoUrl}/blob/${branch || "main"}` : "#";
      const linkUrl =
        startLine === endLine
          ? `${repoBaseUrl}/${filename}#L${startLine}`
          : `${repoBaseUrl}/${filename}#L${startLine}-L${endLine}`;

      return `[${displayText}](${linkUrl}) `;
    }
  );
};

interface MarkdownProps {
  children: string;
  repoUrl?: string;
  branch?: string;
}

const NonMemoizedMarkdown = ({ children, repoUrl, branch }: MarkdownProps) => {
  const processedContent = processCitations(children, repoUrl, branch);

  return (
    <div
      className="markdown-content max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      style={{
        width: "100%",
        maxWidth: "100%",
        whiteSpace: "pre-wrap",
        wordWrap: "break-word",
        overflowWrap: "break-word"
      }}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.repoUrl === nextProps.repoUrl &&
    prevProps.branch === nextProps.branch
);
