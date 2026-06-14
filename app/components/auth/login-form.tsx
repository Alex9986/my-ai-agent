"use client";

import { useState } from "react";
import { Sparkles, User, Lock, LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

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
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="pl-8"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-2">
          <Button
            className="w-full gap-2"
            onClick={handleLogin}
            disabled={loading}
          >
            <LogIn className="w-4 h-4" />
            {loading ? "登录中..." : "登录"}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
