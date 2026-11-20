// Tela provisória do esqueleto (W1-01). O i18n de verdade (t(), detecção, seletor) é a W1-05 do App.
import strings from "../../i18n/pt-BR.json";

export function App() {
  return (
    <main>
      <h1>{strings["app.name"]}</h1>
      <p>{strings["app.tagline"]}</p>
      <p>{strings["app.under_construction"]}</p>
    </main>
  );
}
