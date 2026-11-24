PMobile — Recuperação de tokens e senhas: horário do último acesso validado.
- Cada conta agora mostra “Último acesso” com data e horário de Brasília, consultados diretamente do campo existente usuarios.ultimo_acesso_em.
- A própria autenticação do PMobile já atualiza esse horário; não foi necessário inserir um novo rastreador nem mudar o login.
- Inclui restaurações de sessão confirmadas online; não é presença em tempo real.
- Se o campo estiver vazio, mostra “não registrado”. A emissão de novas credenciais provisórias, pelo fluxo já existente, apaga o horário até o próximo login.
- Nova RPC somente de leitura com validação de ADMIN. A RPC anterior permanece disponível para clientes antigos.
- Nenhuma senha, token, hash ou credencial é retornada ao frontend; somente metadados já autorizados.
- Não modifica permissões, hierarquia, dados de usuários ou fluxos de emissão e recuperação.
