/**
 * Lê um arquivo escolhido (ou solto) como texto. `File.text()` existe em todo
 * navegador de hoje, mas não no jsdom da suíte — e a leitura por `FileReader`
 * é a mesma nos dois, então é ela que vale, sem caminho especial para teste.
 */
export class FileText {
  static of(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error ?? new Error("leitura do arquivo falhou"));
      reader.readAsText(file);
    });
  }
}
