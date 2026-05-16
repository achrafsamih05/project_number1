"use client";

import { useI18n } from "@/lib/useI18n";

export function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-900 shadow-sm sm:p-6">
      {/* تأثيرات إضاءة خفيفة جداً في الخلفية لتقليل التشتت */}
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-500/10 blur-2xl" />
      
      <div className="relative flex flex-col items-center text-center space-y-2">
        {/* شارة صغيرة جداً */}
        <span className="inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white uppercase">
          {t("brand.name")}
        </span>
        
        {/* عنوان بحجم أصغر (text-xl إلى text-3xl) */}
        <h1 className="text-xl font-bold leading-tight tracking-tight text-slate-950 sm:text-3xl">
          {t("hero.title")}
        </h1>
        
        {/* وصف مقتضب جداً وحجم خط صغير */}
        <p className="max-w-md text-xs text-slate-600 sm:text-sm">
          {t("hero.subtitle")}
        </p>
      </div>
    </section>
  );
}
