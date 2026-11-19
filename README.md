<p align="center">
  <img src="assets/readme/banner.png" alt="Shiai Manager — gestão de campeonatos de karatê" width="100%">
</p>

<h3 align="center">Do cadastro dos atletas à súmula impressa, num só lugar.</h3>

<p align="center">
  <a href="https://shiai-manager.pages.dev"><img alt="Acessar o Shiai Manager" src="https://img.shields.io/badge/ACESSAR_O_SHIAI_MANAGER-D12A3A?style=for-the-badge&logoColor=white"></a>
  &nbsp;
  <a href="https://github.com/gabrielwhz/shiai-manager/releases/latest/download/Shiai.Manager.-.EXTRAIA.zip"><img alt="Baixar o placar para Windows" src="https://img.shields.io/badge/BAIXAR_O_PLACAR_(WINDOWS)-2357C9?style=for-the-badge&logo=windows&logoColor=white"></a>
</p>

<p align="center">
  <img alt="Funciona no celular" src="https://img.shields.io/badge/funciona_no_celular-15203B?style=flat-square">
  <img alt="Sem instalação" src="https://img.shields.io/badge/sem_instalação-15203B?style=flat-square">
  <img alt="Placar offline" src="https://img.shields.io/badge/placar_funciona_sem_internet-15203B?style=flat-square">
</p>

---

## 🥋 O que é o Shiai Manager

**Shiai** (試合) significa *competição* em japonês.

O **Shiai Manager** é um sistema para organizar campeonatos de karatê. O organizador cria a competição e as categorias, e cada professor inscreve os próprios alunos pela conta dele. No dia do evento, as chaves são sorteadas em um clique, as súmulas saem prontas em PDF e o placar eletrônico mostra as lutas na TV.

Não precisa instalar nada para usar o site: ele funciona no navegador do computador, do tablet e do celular.

<p align="center">
  <img src="assets/readme/tela-painel.png" alt="Tela de competições do Shiai Manager" width="90%">
</p>

## 📑 Neste manual

- [Primeiros passos](#primeiros-passos)
- [Guia do organizador](#organizador)
- [Guia do professor](#professor)
- [Guia do mesário](#mesario)
- [Minha conta](#conta)
- [Mesa da competição](#mesa)
- [Aplicativo para Windows (offline)](#placar)
- [Dicas para o dia do evento](#dicas)
- [Perguntas frequentes](#faq)
- [Suporte](#suporte)
- [Créditos](#creditos)

<a id="primeiros-passos"></a>

## 🚀 Primeiros passos

1. Acesse **[shiai-manager.pages.dev](https://shiai-manager.pages.dev)** e clique em **Criar conta**.
2. Preencha seu nome, e-mail e senha.
3. Abra o e-mail **"Shiai Manager: confirme sua conta"** e clique em **Confirmar minha conta**. Se não encontrar, olhe a pasta de spam.
4. Pronto: você já entra na tela **Minhas competições**.

> Organizadores e professores usam o **mesmo tipo de conta**. O que muda é o papel em cada competição: quem cria a competição é o organizador dela, e quem foi convidado é professor.

<a id="organizador"></a>

## 🏆 Guia do organizador

### 1. Criar a competição

Em **Minhas competições**, clique em **+ Criar competição** e preencha:

| Campo | Exemplo |
|---|---|
| Logo | A imagem do evento (PNG ou JPG) |
| Nome | Copa Regional de Karatê 2027 |
| Local | Ginásio Municipal, Vitória da Conquista |
| Data | Um ou mais dias (**+ Adicionar outro dia**) |
| Federação | Federação Baiana de Karatê |
| Categorias | Já pode criar aqui ou depois |

### 2. Montar as categorias

Na aba **Categorias**, clique em **+ Adicionar categorias**. Cada categoria tem:

- **Código:** o número que aparece na súmula. Deixe em branco para numerar automaticamente.
- **Nome**, **modalidade** (Kata ou Kumitê) e **sexo** (masculino, feminino ou misto).
- **Idade de / até** e, se quiser, as **faixas** aceitas.
- **PCD:** marque quando a categoria for para atletas com deficiência. Ela só aparece para os atletas cadastrados como PCD.

Use **+ Adicionar outra categoria** para cadastrar várias de uma vez. Clique numa categoria para ver os atletas inscritos nela, ou em **Mostrar atletas de todas**.

<p align="center">
  <img src="assets/readme/tela-categorias.png" alt="Categorias com os atletas inscritos" width="90%">
</p>

### 3. Montar a equipe

Na aba **Equipe**, digite o e-mail da pessoa, escolha o **cargo** e clique em **Enviar convite**. O convite aparece em **Notificações**, na conta dela.

| Cargo | O que faz |
|---|---|
| **Professor** | Cadastra e vê só os próprios atletas. Depois do início, também pode abrir a mesa. |
| **Mesário** | Não vê atletas nem categorias. Só abre a mesa da competição, depois do início. |

- A pessoa precisa **já ter conta** no Shiai Manager, com o e-mail confirmado.
- Dá para mudar o cargo de quem já está na equipe, cancelar convites ou remover pessoas a qualquer momento. Os atletas de um professor removido continuam inscritos.

### 4. Acompanhar as inscrições

A aba **Atletas** mostra todos os inscritos, quem cadastrou cada um e em quais categorias estão. Use a busca para achar por nome, equipe ou categoria.

O botão **Tabela de atletas (PDF)** gera a lista completa em ordem alfabética, com as categorias de Kata e Kumitê de cada atleta. Na janela de impressão, escolha **Salvar como PDF**.

<p align="center">
  <img src="assets/readme/tela-atletas.png" alt="Cadastro e lista de atletas" width="90%">
</p>

### 5. Gerar as súmulas

Na aba **Súmulas**:

1. Clique em **Sortear todas**. O sistema monta as chaves de todas as categorias e tenta evitar que atletas da mesma equipe se enfrentem logo na primeira luta.
2. Escolha como baixar:
   - **Baixar PDF:** a súmula da categoria selecionada.
   - **Todas em um único PDF:** uma página por categoria, pronto para imprimir.
   - **Todas em ZIP:** um arquivo por categoria, cada um com o nome dela.
3. Precisa refazer? Use **Sortear de novo** numa categoria, ou **Apagar** para descartar o sorteio. Os atletas continuam inscritos.

Se alguém for inscrito ou removido depois do sorteio, a categoria fica marcada com um aviso para você sortear de novo. A opção **Súmula em branco** gera uma chave vazia para preencher à mão.

<p align="center">
  <img src="assets/readme/sumula-pdf.png" alt="Súmula gerada em PDF" width="90%"><br>
  <sub>Súmula em A4 deitado: ordem das lutas, cores AKA e AO, árbitros, mesários e classificação.</sub>
</p>

### 6. Iniciar a competição

No dia do evento, clique em **▶ Iniciar competição**, no topo da página da competição.

> 🔒 **Ao iniciar, as inscrições, as categorias e as súmulas ficam trancadas** enquanto a competição estiver em andamento. Ninguém consegue cadastrar, editar ou sortear de novo.

- Se alguma categoria com atletas ainda não foi sorteada, o sistema oferece **sortear e iniciar** de uma vez.
- A **mesa da competição** é liberada para você, para os professores e para os mesários.
- Errou e quer voltar? Em **Dados da competição**, use **Voltar para inscrições**. Isso só funciona enquanto nenhuma luta tiver sido registrada.

### 7. Acompanhar ao vivo

Com a competição em andamento, a aba **Súmulas** mostra, para cada categoria:

- **Situação:** aguardando, em andamento (e em qual koto) ou concluída. A tela se atualiza sozinha a cada 15 segundos.
- **A chave com os vencedores** e a lista de lutas com o resultado de cada uma.
- **A classificação final** (1º, 2º, 3º e 4º) quando a categoria é concluída.
- **A pasta de arquivos da categoria**, com:
  - a súmula **com os vencedores**;
  - a **súmula de kumitê**, no modelo de 6 lutas por folha, preenchida sozinha pela mesa a cada luta;
  - o botão **Baixar a pasta (ZIP)**, com tudo de uma vez.

Se um koto parar de responder, use **Liberar a mesa desta categoria** para outro koto assumir. Para corrigir uma categoria concluída, use **Reabrir categoria**.

### 8. Finalizar

Quando todas as categorias terminarem, clique em **Finalizar competição**. Os resultados e os arquivos continuam disponíveis para consulta. Precisa corrigir algo? Use **Reabrir competição**.

### 9. Editar ou excluir a competição

Na aba **Dados da competição**, você muda o nome, o local, as datas, a federação e a logo. Lá também fica a opção de **excluir a competição**, que apaga tudo o que há nela e não pode ser desfeita.

<a id="professor"></a>

## 👨‍🏫 Guia do professor

1. **Aceite o convite:** abra **Notificações** no topo da tela e clique em **Aceitar**.
2. **Cadastre os alunos:** na competição, preencha nome, idade, sexo, faixa e equipe. Marque **Kata**, **Kumitê** ou os dois. O sistema sugere a categoria certa pela idade e pelo sexo; confira se a faixa combina.
3. **Atleta PCD:** ligue a opção **Atleta PCD** e descreva a deficiência ou condição. O formulário passa a mostrar só as categorias PCD da competição.
4. **Edite quando precisar:** use ✏️ para corrigir um cadastro e 🗑️ para remover.

> **O mesmo aluno em Kata e Kumitê:** marque os dois de uma vez. Se você cadastrar o aluno de novo em outra modalidade, o sistema pergunta se quer **juntar no mesmo cadastro**. Assim ele não aparece duplicado.

<p align="center">
  <img src="assets/readme/tela-celular.png" alt="Shiai Manager no celular" width="85%"><br>
  <sub>Dá para inscrever os alunos pelo celular.</sub>
</p>

<a id="mesario"></a>

## 🧑‍⚖️ Guia do mesário

1. **Aceite o convite** em **Notificações**.
2. Na competição, aparece o botão **Abrir mesa da competição**. Ele fica bloqueado até o organizador iniciar a competição.
3. No dia do evento, abra a mesa e siga a [Mesa da competição](#mesa).

<a id="mesa"></a>

## 🥋 Mesa da competição

A mesa é o placar eletrônico dentro do Shiai Manager. Ela abre no navegador e **já puxa as súmulas e salva os resultados**. Fica disponível para o organizador, os professores e os mesários depois que a competição é iniciada.

### Passo a passo no koto
1. Escreva o nome do koto (ex.: **Koto 1**).
2. Quando a súmula de uma categoria chegar ao koto, digite o **código** dela e abra a categoria. Ela fica reservada para o seu koto, e nenhum outro koto consegue registrar resultados nela ao mesmo tempo.
3. As lutas aparecem **na ordem da súmula**. Clique em **Chamar luta**: os nomes do AKA e do AO vão direto para o placar.
4. Conduza a luta normalmente, com placar, cronômetro e TV.
5. Marque o vencedor no placar (**AKA venceu** ou **AO venceu**) e clique em **Confirmar resultado**. O vencedor avança na chave e a próxima luta já aparece com os nomes certos.
6. Depois da final, clique em **Concluir categoria**. A classificação vai direto para a súmula no Shiai Manager.

### Bom saber
- **Kata:** escolha o sistema de avaliação, **Bandeiras** ou **Notas**, no placar. Na confirmação, dá para anotar as bandeiras ou as notas de cada atleta.
- **Kumitê:** enquanto você conduz a luta, a mesa registra cada ponto, penalidade e senshu com o tempo. Ao confirmar, a luta entra na **súmula de kumitê** da categoria, que fica na pasta de arquivos. Na confirmação, marque se a luta terminou por **Kiken** ou **Hansoku**.
- **Inverter cores** no placar não atrapalha: o resultado é registrado para o atleta certo.
- **Errou um resultado?** Use **Desfazer**. As lutas seguintes que dependiam dele também são desfeitas.
- **Caiu a internet?** O resultado fica guardado no computador e é enviado sozinho quando a conexão voltar. Não feche a página enquanto aparecer o aviso amarelo.
- **3º e 4º lugar:** não há luta de 3º lugar. O perdedor da semifinal do campeão fica em 3º, e o perdedor da semifinal do vice fica em 4º.
- **TV:** clique em **Abrir placar da TV**, arraste a janela para a TV e coloque em tela cheia, como no aplicativo.

<a id="conta"></a>

## 👤 Minha conta

Clique na sua foto ou no seu nome, no topo da tela:

- **Foto e nome:** troque e clique em **Salvar perfil**.
- **Senha:** clique em **Enviar link para trocar a senha** e abra o e-mail que chegar. Esqueceu a senha? Use **Esqueci minha senha** na tela de entrada.
- **Excluir conta:** digite sua senha para confirmar. As competições que você organiza são apagadas junto.

<a id="placar"></a>

## 🖥️ Aplicativo para Windows (offline)

<p align="center">
  <img src="assets/readme/placar.png" alt="Placar eletrônico — mesa de controle" width="90%">
</p>

É o mesmo placar da mesa, em forma de programa para Windows. **Funciona sem internet**, mas não se conecta às súmulas: os nomes e os resultados são preenchidos à mão. **O recomendado é usar a [mesa da competição](#mesa)**, que evita erros de digitação e já monta as súmulas. Use o aplicativo quando o local não tiver internet.

### Instalar
1. **[Baixe o Shiai Manager para Windows](https://github.com/gabrielwhz/shiai-manager/releases/latest/download/Shiai.Manager.-.EXTRAIA.zip)**.
2. Clique com o botão direito no arquivo baixado e escolha **Extrair tudo**.
3. Abra a pasta e dê dois cliques em **`Shiai Manager.exe`**. Não mexa na pasta `Arquivos`.

> Na primeira vez, o Windows pode mostrar *"O Windows protegeu o computador"*. Clique em **Mais informações → Executar assim mesmo**.

### Ligar na TV
1. Conecte a TV ou o projetor pelo cabo HDMI.
2. Aperte <kbd>Windows</kbd> + <kbd>P</kbd> e escolha **Estender**.
3. No programa, clique em **Abrir placar da TV**. O placar abre sozinho em tela cheia na TV.

### Usar
| Kumitê | Kata |
|---|---|
| Wazari (+1) e Ippon (+2) | Avaliação por bandeiras ou por notas |
| Senshu e penalidades | Nome do atleta e kata apresentado |
| Cronômetro, ajuste de ±1 s | Atleta que está apresentando |
| Tela de vencedor e empate | Tela de vencedor |

Nas duas modalidades:
- **⇄ Inverter cores:** troca tudo do AKA para o AO, e vice-versa.
- **↶ Desfazer:** volta a última ação.
- **Tema escuro:** muda as cores da mesa de controle.
- **Tela cheia:** dois cliques no placar entram ou saem da tela cheia, e <kbd>Esc</kbd> sai.

Os dados da luta ficam salvos mesmo se o programa for fechado.

<a id="dicas"></a>

## ✅ Dicas para o dia do evento

- **Feche as inscrições** antes de sortear, combinando um prazo com os professores.
- **Sorteie e baixe as súmulas na véspera** e imprima em A4, folha deitada.
- **Baixe também o ZIP** e guarde no pendrive: é uma cópia de segurança, uma súmula por arquivo.
- **Imprima a Tabela de atletas** para a mesa de recepção conferir os nomes.
- **Teste o placar na TV do local** antes do evento: cabo HDMI e Windows + P.
- **Confira a internet de cada koto** antes de iniciar. Se o local não tiver internet, use o aplicativo para Windows.
- **Combine o nome de cada koto** (Koto 1, Koto 2…) com os mesários antes de começar.
- **Leve algumas súmulas em branco** para imprevistos.

<a id="faq"></a>

## ❓ Perguntas frequentes

<details>
<summary><b>O e-mail de confirmação ou de senha não chegou.</b></summary>

Espere alguns minutos e olhe a pasta de **spam** e a aba **Promoções**. Na tela de entrada, você pode pedir um novo e-mail em **Reenviar e-mail de confirmação**.
</details>

<details>
<summary><b>Convidei um professor e apareceu "não existe conta com esse e-mail".</b></summary>

O professor precisa criar a conta e confirmar o e-mail antes. Confira também se o e-mail digitado é exatamente o da conta dele.
</details>

<details>
<summary><b>O professor consegue ver os atletas de outras equipes?</b></summary>

Não. Cada professor vê somente os atletas que ele cadastrou. Só o organizador vê todos.
</details>

<details>
<summary><b>Um atleta não combina com nenhuma categoria. E agora?</b></summary>

O organizador pode criar a categoria que falta, ou o professor pode escolher manualmente em **Outras categorias**, na lista de categorias do cadastro.
</details>

<details>
<summary><b>Como funciona a inscrição de atletas PCD?</b></summary>

O organizador cria as categorias PCD marcando a opção **PCD**. No cadastro, o professor liga **Atleta PCD** e descreve a deficiência ou condição; aparecem só as categorias PCD. Na lista e na tabela de atletas, o atleta ganha a etiqueta **PCD**, e a súmula indica "(PCD)" na categoria.
</details>

<details>
<summary><b>Por que não consigo mais cadastrar atletas?</b></summary>

A competição já foi iniciada. As inscrições, as categorias e as súmulas ficam trancadas enquanto ela estiver em andamento. Se nenhuma luta foi registrada, o organizador pode usar **Voltar para inscrições**, em **Dados da competição**.
</details>

<details>
<summary><b>Dois kotos podem usar a mesma categoria?</b></summary>

Não. Quando um koto abre uma categoria, ela fica reservada para ele. Se o koto parar de responder, o organizador pode liberar a categoria na aba **Súmulas**.
</details>

<details>
<summary><b>Posso refazer o sorteio?</b></summary>

Sim, quantas vezes quiser, por categoria (**Sortear de novo**) ou todas de uma vez (**Sortear todas → Sortear todas de novo**).
</details>

<details>
<summary><b>O placar funciona no Mac ou no Linux?</b></summary>

Por enquanto, o placar eletrônico é só para Windows (7, 8, 10 e 11, 64 bits).
</details>

<details>
<summary><b>Meus dados estão seguros?</b></summary>

Cada pessoa acessa somente o que pertence a ela: o professor vê os próprios atletas, e o organizador vê a competição que criou. As senhas não ficam visíveis para ninguém, nem para a equipe do Shiai Manager.
</details>

<a id="suporte"></a>

## 💬 Suporte

Encontrou um problema ou tem uma sugestão?

- ✉️ **E-mail:** [shiaimanager@gmail.com](mailto:shiaimanager@gmail.com)
- 🐞 **Relatar um problema:** abra uma [issue](../../issues) aqui no GitHub, contando o que aconteceu e, se puder, com um print da tela.

As novidades de cada versão do placar ficam em [Releases](../../releases).

<a id="creditos"></a>

## 🙏 Créditos

**Criado e desenvolvido por [Gabriel Araújo](https://github.com/gabrielwhz).**

O Shiai Manager nasceu da organização da **I Copinha ASDOKS**. Obrigado aos professores, atletas e organizadores que testaram e ajudaram a moldar o sistema.

Construído com: [Supabase](https://supabase.com) · [Cloudflare Pages](https://pages.cloudflare.com) · [Brevo](https://www.brevo.com) · [Electron](https://www.electronjs.org) · fonte [Barlow](https://fonts.google.com/specimen/Barlow), de Jeremy Tribby.

## 📄 Licença

© 2026 Gabriel Araújo. Todos os direitos reservados. Veja os termos em [LICENSE](LICENSE).

<p align="center"><br><img src="assets/logo.svg" alt="" width="48"><br><sub><b>Shiai Manager</b> · Oss! 🥋</sub></p>
