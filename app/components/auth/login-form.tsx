"use client";

import { useState } from "react";
import { Sparkles, User, Lock, LogIn, Eye, EyeOff, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

const DEMO_ACCOUNTS = [
  { username: "test1", password: "pass123", color: "from-indigo-500 to-purple-500" },
  { username: "demo", password: "demo", color: "from-emerald-500 to-teal-500" },
  { username: "dev", password: "dev", color: "from-amber-500 to-orange-500" },
];

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(user?: string, pass?: string) {
    const trimmedUser = (user ?? username).trim();
    const trimmedPass = (pass ?? password).trim();

    if (!trimmedUser || !trimmedPass) {
      setError("请输入用户名和密码");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await onLogin(trimmedUser, trimmedPass);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "登录失败，请重试"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleLogin();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card className="w-[340px] shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          </div>
          <CardTitle className="text-lg">AI Todo</CardTitle>
          <CardDescription className="text-xs">请输入用户名和密码以继续</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="用户名"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="pl-8"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="pl-8 pr-8"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                title={showPassword ? "隐藏密码" : "显示密码"}
              >
                {showPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-2 flex flex-col gap-3">
          <Button
            className="w-full gap-2"
            onClick={() => handleLogin()}
            disabled={loading}
          >
            <LogIn className="w-4 h-4" />
            {loading ? "登录中..." : "登录"}
          </Button>

          {/* Demo accounts */}
          <div className="w-full pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">演示账号（每人独立任务）</span>
            </div>
            <div className="flex gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => {
                    setUsername(acc.username);
                    setPassword(acc.password);
                    setError(null);
                    // Auto-login after a brief fill animation
                    setTimeout(() => handleLogin(acc.username, acc.password), 200);
                  }}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-xs font-medium text-foreground/80 hover:text-foreground"
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-gradient-to-br ${acc.color} inline-flex items-center justify-center text-[8px] text-white font-bold`}
                  >
                    {acc.username[0].toUpperCase()}
                  </span>
                  {acc.username}
                </button>
              ))}
            </div>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
