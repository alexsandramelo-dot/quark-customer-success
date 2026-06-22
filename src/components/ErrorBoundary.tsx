import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary detectou um crash de renderização não tratado:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReset = () => {
    try {
      localStorage.clear();
      console.log("Cache local limpo via Error Boundary de segurança.");
    } catch (e) {
      console.error("Não foi possível limpar o localStorage:", e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 antialiased" id="quarks-fallback-ui">
          <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6 animate-fade-in">
            <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-white font-sans tracking-wide">
                Ops! Ocorreu um desvio inesperado
              </h2>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Um erro inesperado de renderização foi interceptado pelo sistema Quark. Fique tranquilo: seus dados de visualização estão seguros.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-left font-mono text-[10px] text-rose-400 max-h-40 overflow-y-auto whitespace-pre-wrap select-text">
                <span className="font-bold text-slate-300">Erro detectado:</span> {this.state.error.toString()}
              </div>
            )}

            <div className="pt-2 flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all active:scale-95 shadow-md shadow-emerald-500/10"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Atualizar Página</span>
              </button>

              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-transparent hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                <span>Limpar Cache & Reiniciar do Zero</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
