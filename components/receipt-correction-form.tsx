'use client'

import { useState, useCallback, useId } from "react"
import type { ReceiptScan, ReceiptItem } from "@/types"

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReceiptCorrectionFormProps {
  scan: ReceiptScan
  onConfirm: (corrected: ReceiptScan) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function itemsSum(items: ReceiptItem[]): number {
  return round2(items.reduce((acc, it) => acc + it.totalPrice, 0))
}

function makeBlankItem(): ReceiptItem {
  return { name: "", quantity: 1, unitPrice: 0, totalPrice: 0 }
}

// ─── Sub-component: item row ──────────────────────────────────────────────────

interface ItemRowProps {
  item: ReceiptItem
  index: number
  onChange: (index: number, updated: ReceiptItem) => void
  onRemove: (index: number) => void
  baseId: string
}

function ItemRow({ item, index, onChange, onRemove, baseId }: ItemRowProps) {
  function handleField<K extends keyof ReceiptItem>(
    field: K,
    rawValue: string
  ) {
    const isNumeric = field !== "name"
    const value = isNumeric ? parseFloat(rawValue) || 0 : rawValue

    let updated: ReceiptItem = { ...item, [field]: value }

    // Auto-recalculate totalPrice when qty or unitPrice changes
    if (field === "quantity" || field === "unitPrice") {
      updated = {
        ...updated,
        totalPrice: round2(
          (field === "quantity" ? (value as number) : updated.quantity) *
          (field === "unitPrice" ? (value as number) : updated.unitPrice)
        ),
      }
    }

    // Auto-recalculate unitPrice when totalPrice is edited manually
    if (field === "totalPrice" && updated.quantity > 0) {
      updated = {
        ...updated,
        unitPrice: round2((value as number) / updated.quantity),
      }
    }

    onChange(index, updated)
  }

  const id = `${baseId}-item-${index}`

  return (
    <div className="grid grid-cols-[1fr_5rem_5rem_5rem_2rem] gap-2 items-center py-1 border-b border-gray-100 last:border-0">
      {/* Name */}
      <input
        aria-label={`Item ${index + 1} name`}
        id={`${id}-name`}
        type="text"
        value={item.name}
        onChange={(e) => handleField("name", e.target.value)}
        placeholder="Item name"
        className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {/* Qty */}
      <input
        aria-label={`Item ${index + 1} quantity`}
        id={`${id}-qty`}
        type="number"
        min={1}
        step={1}
        value={item.quantity}
        onChange={(e) => handleField("quantity", e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {/* Unit price */}
      <input
        aria-label={`Item ${index + 1} unit price`}
        id={`${id}-unit`}
        type="number"
        min={0}
        step={0.01}
        value={item.unitPrice}
        onChange={(e) => handleField("unitPrice", e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {/* Total price */}
      <input
        aria-label={`Item ${index + 1} total price`}
        id={`${id}-total`}
        type="number"
        min={0}
        step={0.01}
        value={item.totalPrice}
        onChange={(e) => handleField("totalPrice", e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {/* Remove */}
      <button
        type="button"
        aria-label={`Remove item ${index + 1}`}
        onClick={() => onRemove(index)}
        className="flex items-center justify-center rounded text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 transition-colors"
      >
        ✕
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReceiptCorrectionForm({
  scan,
  onConfirm,
}: ReceiptCorrectionFormProps) {
  const baseId = useId()

  const [merchant, setMerchant] = useState(scan.merchant)
  const [currency, setCurrency] = useState(scan.currency)
  const [total, setTotal] = useState(scan.total)
  const [tax, setTax] = useState<number | undefined>(scan.tax)
  const [items, setItems] = useState<ReceiptItem[]>(
    scan.items.length > 0 ? scan.items : [makeBlankItem()]
  )

  // ── Item handlers ──────────────────────────────────────────────────────────

  const handleItemChange = useCallback(
    (index: number, updated: ReceiptItem) => {
      setItems((prev) =>
        prev.map((it, i) => (i === index ? updated : it))
      )
    },
    []
  )

  const handleItemRemove = useCallback((index: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length > 0 ? next : [makeBlankItem()]
    })
  }, [])

  const handleAddItem = () => {
    setItems((prev) => [...prev, makeBlankItem()])
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const calculatedSum = itemsSum(items)
  const mismatch = Math.abs(calculatedSum - total) > 0.01

  // ── Submit ─────────────────────────────────────────────────────────────────

  function handleConfirm() {
    const corrected: ReceiptScan = {
      merchant: merchant.trim() || "Unknown",
      currency: currency.trim().toUpperCase() || "USD",
      total,
      ...(tax !== undefined ? { tax } : {}),
      items,
      ...(scan.rawImageUrl ? { rawImageUrl: scan.rawImageUrl } : {}),
    }
    onConfirm(corrected)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-lg mx-auto rounded-2xl bg-white shadow-md p-5 space-y-5">
      <h2 className="text-lg font-semibold text-gray-800">Review Receipt</h2>

      {/* ── Header fields ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Merchant */}
        <div className="col-span-2 flex flex-col gap-1">
          <label
            htmlFor={`${baseId}-merchant`}
            className="text-xs font-medium text-gray-500 uppercase tracking-wide"
          >
            Merchant
          </label>
          <input
            id={`${baseId}-merchant`}
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Restaurant / Store name"
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Currency */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${baseId}-currency`}
            className="text-xs font-medium text-gray-500 uppercase tracking-wide"
          >
            Currency
          </label>
          <input
            id={`${baseId}-currency`}
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            maxLength={3}
            placeholder="EUR"
            className="rounded border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Tax */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`${baseId}-tax`}
            className="text-xs font-medium text-gray-500 uppercase tracking-wide"
          >
            Tax (optional)
          </label>
          <input
            id={`${baseId}-tax`}
            type="number"
            min={0}
            step={0.01}
            value={tax ?? ""}
            onChange={(e) => {
              const v = e.target.value
              setTax(v === "" ? undefined : parseFloat(v) || 0)
            }}
            placeholder="0.00"
            className="rounded border border-gray-300 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Total */}
        <div className="col-span-2 flex flex-col gap-1">
          <label
            htmlFor={`${baseId}-total`}
            className="text-xs font-medium text-gray-500 uppercase tracking-wide"
          >
            Total
          </label>
          <input
            id={`${baseId}-total`}
            type="number"
            min={0}
            step={0.01}
            value={total}
            onChange={(e) => setTotal(parseFloat(e.target.value) || 0)}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-right font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* ── Items table ── */}
      <div>
        <div className="grid grid-cols-[1fr_5rem_5rem_5rem_2rem] gap-2 mb-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Item</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Qty</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Unit</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Total</span>
          <span />
        </div>

        <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg px-2">
          {items.map((item, index) => (
            <ItemRow
              key={index}
              item={item}
              index={index}
              onChange={handleItemChange}
              onRemove={handleItemRemove}
              baseId={baseId}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddItem}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          + Add item
        </button>
      </div>

      {/* ── Running total + mismatch warning ── */}
      <div className="rounded-lg bg-gray-50 px-4 py-3 flex items-center justify-between text-sm">
        <span className="text-gray-500">Items sum</span>
        <span className={`font-semibold ${mismatch ? "text-amber-600" : "text-gray-800"}`}>
          {currency} {calculatedSum.toFixed(2)}
        </span>
      </div>

      {mismatch && (
        <p
          role="alert"
          className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
        >
          Items sum ({currency} {calculatedSum.toFixed(2)}) does not match
          the total ({currency} {total.toFixed(2)}). Please adjust before
          confirming.
        </p>
      )}

      {/* ── Confirm button ── */}
      <button
        type="button"
        onClick={handleConfirm}
        className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 text-sm transition-colors"
      >
        Confirm split
      </button>
    </div>
  )
}
