'use client';
import { RouteError } from '@/components/ui/RouteFallbacks';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError reset={reset} />;
}
