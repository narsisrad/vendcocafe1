import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CartSummary, User } from '../types';
import { apiFetch } from '../lib/format';

interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

interface StoreContextValue {
  currentPath: string;
  navigate: (path: string) => void;
  user: User | null;
  setUser: (u: User | null) => void;
  refreshUser: () => Promise<void>;
  cart: CartSummary | null;
  refreshCart: (shippingMethodId?: number | null) => Promise<void>;
  addToCart: (productId: number, variantId: number, quantity?: number, openDrawer?: boolean) => Promise<void>;
  updateCartItem: (itemId: number, quantity: number) => Promise<void>;
  removeCartItem: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  isCartDrawerOpen: boolean;
  setCartDrawerOpen: (v: boolean) => void;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (v: boolean) => void;
  notify: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname + window.location.search);
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [isCartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const syncDocumentSeo = useCallback(async (pathname: string) => {
    try {
      const cleanPath = pathname.split('?')[0] || '/';
      const data = await apiFetch<{ seo: any; schemas: any[] }>(`/api/seo/resolve?path=${encodeURIComponent(cleanPath)}`);
      if (data.seo?.seo_title) {
        document.title = data.seo.seo_title;
      }
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && data.seo?.meta_description) {
        metaDesc.setAttribute('content', data.seo.meta_description);
      }
    } catch {
      // ignore seo fetch error
    }
  }, []);

  const navigate = useCallback(
    (path: string) => {
      if (path === currentPath) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      syncDocumentSeo(path);
    },
    [currentPath, syncDocumentSeo]
  );

  useEffect(() => {
    const onPopState = () => {
      const next = window.location.pathname + window.location.search;
      setCurrentPath(next);
      syncDocumentSeo(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [syncDocumentSeo]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: User | null }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  const refreshCart = useCallback(async (shippingMethodId: number | null = null) => {
    try {
      const url = shippingMethodId ? `/api/cart?shippingMethodId=${shippingMethodId}` : '/api/cart';
      const data = await apiFetch<CartSummary>(url);
      setCart(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshUser();
    refreshCart();
    syncDocumentSeo(window.location.pathname);
  }, [refreshUser, refreshCart, syncDocumentSeo]);

  const addToCart = async (productId: number, variantId: number, quantity = 1, openDrawer = true) => {
    try {
      const data = await apiFetch<CartSummary>('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, variant_id: variantId, quantity, mode: 'add' }),
      });
      setCart(data);
      notify('کالا با موفقیت به سبد خرید اضافه شد');
      if (openDrawer) setCartDrawerOpen(true);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const updateCartItem = async (itemId: number, quantity: number) => {
    try {
      const data = await apiFetch<CartSummary>(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      });
      setCart(data);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const removeCartItem = async (itemId: number) => {
    try {
      const data = await apiFetch<CartSummary>(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
      });
      setCart(data);
      notify('کالا از سبد خرید حذف شد', 'info');
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const clearCart = async () => {
    try {
      const data = await apiFetch<CartSummary>('/api/cart', { method: 'DELETE' });
      setCart(data);
      notify('سبد خرید پاک شد', 'info');
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const applyCoupon = async (code: string) => {
    try {
      const data = await apiFetch<CartSummary>('/api/cart/coupon', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      setCart(data);
      notify(code ? 'کد تخفیف با موفقیت اعمال شد' : 'کد تخفیف حذف شد');
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  return (
    <StoreContext.Provider
      value={{
        currentPath,
        navigate,
        user,
        setUser,
        refreshUser,
        cart,
        refreshCart,
        addToCart,
        updateCartItem,
        removeCartItem,
        clearCart,
        applyCoupon,
        isCartDrawerOpen,
        setCartDrawerOpen,
        isAuthModalOpen,
        setAuthModalOpen,
        notify,
      }}
    >
      {children}
      {/* Toast Notifications */}
      <div className="fixed bottom-5 left-5 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all ${
              t.type === 'error'
                ? 'bg-[#8E0D11] text-white border-[#B11116]'
                : t.type === 'info'
                ? 'bg-[#111111] text-white border-[#262626]'
                : 'bg-[#B11116] text-white border-[#8E0D11]'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
