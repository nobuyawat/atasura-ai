'use client';

/**
 * Checkoutキャンセルページ (/checkout/cancel)
 */

import Link from 'next/link';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-[#05060f] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-orange-500/20 rounded-full mb-4">
            <XCircle className="w-12 h-12 text-orange-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-black mb-4">
          お支払いが<span className="text-orange-400">キャンセル</span>されました
        </h1>
        <p className="text-gray-400 mb-8">
          お支払いは完了していません。
          <br />
          もう一度お試しいただくか、無料プランでご利用ください。
        </p>

        {/* Actions */}
        <div className="space-y-4">
          <Link
            href="/pricing"
            className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-[#FF1E56] to-purple-600 text-white rounded-full font-bold text-lg transition-all hover:opacity-90"
          >
            <RefreshCw className="w-5 h-5" />
            もう一度試す
          </Link>

          <Link
            href="/app"
            className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-white/10 border border-white/20 text-white rounded-full font-bold text-lg transition-all hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
            無料プランで続ける
          </Link>
        </div>

        {/* Help */}
        <p className="mt-8 text-gray-500 text-sm">
          お問い合わせ：
          <a href="mailto:support@atasura.ai" className="text-[#FF1E56] hover:underline">
            support@atasura.ai
          </a>
        </p>
      </div>
    </div>
  );
}
