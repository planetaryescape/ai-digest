"use client";

import { Calendar, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Schedule: Sunday (0) and Thursday (4) at 10:00 AM UTC
const SCHEDULE_DAYS = [0, 4]; // Sunday, Thursday
const SCHEDULE_HOUR_UTC = 10;

function getNextDigestDate(): Date {
  const now = new Date();
  const currentDay = now.getUTCDay();
  const currentHour = now.getUTCHours();

  // Find next scheduled day
  let daysUntilNext = Infinity;
  for (const scheduleDay of SCHEDULE_DAYS) {
    let days = scheduleDay - currentDay;
    if (days < 0) days += 7;
    if (days === 0 && currentHour >= SCHEDULE_HOUR_UTC) {
      days = 7;
    }
    daysUntilNext = Math.min(daysUntilNext, days);
  }

  // Calculate next date
  const nextDate = new Date(now);
  nextDate.setUTCDate(now.getUTCDate() + daysUntilNext);
  nextDate.setUTCHours(SCHEDULE_HOUR_UTC, 0, 0, 0);

  return nextDate;
}

function formatCountdown(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  return { days, hours, minutes, seconds };
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

export function NextDigestCountdown() {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [nextDate, setNextDate] = useState<Date>(getNextDigestDate());

  useEffect(() => {
    const updateCountdown = () => {
      const next = getNextDigestDate();
      setNextDate(next);
      setTimeRemaining(next.getTime() - Date.now());
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const countdown = formatCountdown(Math.max(0, timeRemaining));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Next Digest
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Countdown */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-muted rounded-lg p-2">
              <div className="text-2xl font-bold">{countdown.days}</div>
              <div className="text-xs text-muted-foreground">days</div>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <div className="text-2xl font-bold">{countdown.hours}</div>
              <div className="text-xs text-muted-foreground">hours</div>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <div className="text-2xl font-bold">{countdown.minutes}</div>
              <div className="text-xs text-muted-foreground">min</div>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <div className="text-2xl font-bold">{countdown.seconds}</div>
              <div className="text-xs text-muted-foreground">sec</div>
            </div>
          </div>

          {/* Schedule info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatDay(nextDate)} at 10:00 AM UTC</span>
          </div>

          {/* Schedule text */}
          <p className="text-xs text-muted-foreground">
            Digests are sent every Sunday and Thursday
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
