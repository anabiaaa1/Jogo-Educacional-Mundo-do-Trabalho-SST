    
    (() => {
      "use strict";

      const byId = (id) => document.getElementById(id);
      const setText = (id, value) => {
        const element = byId(id);
        if (element) element.textContent = value;
      };

      const toggleModal = (id, visible = true) => {
        const element = byId(id);
        if (element) element.classList.toggle("show", visible);
      };

      const canvas = byId("game");
      const ctx = canvas ? canvas.getContext("2d") : null;

      if (!canvas || !ctx) return;

      const W = 960;
      const H = 540;
      const keys = Object.create(null);
      const touchKeys = Object.create(null);

      let state = "menu";
      let night = 0;
      let safety = 100;
      let totalScore = 0;
      let player = null;
      let enemy = null;
      let objects = [];
      let walls = [];
      let missionIndex = 0;
      let chase = false;
      let escapeHits = 0;
      let lastFrame = 0;
      let feedbackTimer = null;
      let nightTimer = null;
      let initialized = false;

      const nightBriefs = [
        ["Seu primeiro turno começa em um supermercado. Você passará pelos setores de caixa, reposição e administrativo.",["Ergonomia","Organização","Postura","Movimentação de cargas"]],
        ["O turno acontece em uma distribuidora, entre conferências e o estoque de medicamentos.",["EPI","Organização de estoque","Conferência","Movimentação segura de cargas"]],
        ["A equipe inicia o trabalho de limpeza na área da piscina, entre água, produtos e piso molhado.",["Produtos químicos","Piso molhado","Sinalização","EPI","Segurança próxima à água"]],
        ["Você assume um turno no setor de Recursos Humanos, onde as relações também exigem cuidado.",["Ergonomia","Comunicação","Respeito","Ambiente de trabalho saudável"]],
        ["Na área de tecnologia, você acompanha uma manutenção que exige atenção e procedimentos claros.",["Ergonomia","Organização de cabos","Segurança elétrica","Procedimentos de manutenção"]]
      ];

      const nights = [
        {
          name:"SUPERMERCADO",
          palette:["#102946","#1e5270","#ff9f43"],
          lesson:"Corredores livres, postura adequada e ajuda para cargas pesadas evitam acidentes.",
          missions:[
            ["Organize a área bloqueada.","Área bloqueada","+10 Segurança"],
            ["Ajuste a postura no caixa.","Caixa ergonômico","+10 Segurança"],
            ["Use o procedimento seguro para a caixa.","Caixa leve","+10 Segurança"],
            ["Peça ajuda com a carga pesada.","Carga pesada","+15 Segurança"]
          ]
        },
        {
          name:"DISTRIBUIDORA DE MEDICAMENTOS",
          palette:["#291841","#51356e","#42b9a9"],
          lesson:"Conferir validade, organizar estoques e usar EPI reduzem erros e riscos.",
          missions:[
            ["Organize o estoque.","Estoque","+10 Segurança"],
            ["Confira o pedido e a validade.","Bancada","+10 Segurança"],
            ["Movimente caixas sem sobrecarga.","Carrinho","+10 Segurança"],
            ["Escolha o EPI adequado.","Armário EPI","+15 Segurança"]
          ]
        },
        {
          name:"LIMPEZA DE PISCINAS",
          palette:["#07384a","#147889","#ffd166"],
          lesson:"Sinalize piso molhado, use EPI e mantenha produtos químicos separados.",
          missions:[
            ["Prepare os equipamentos.","Equipamentos","+10 Segurança"],
            ["Sinalize o piso molhado.","Placa amarela","+10 Segurança"],
            ["Organize produtos sem misturá-los.","Depósito químico","+10 Segurança"],
            ["Guarde o equipamento após usar.","Vestiário","+15 Segurança"]
          ]
        },
        {
          name:"RECURSOS HUMANOS",
          palette:["#17254b","#e49aae","#f7e7c6"],
          lesson:"Respeito, ergonomia e comunicação saudável também são segurança no trabalho.",
          missions:[
            ["Organize documentos.","Arquivo","+10 Segurança"],
            ["Ajuste seu posto de trabalho.","Mesa","+10 Segurança"],
            ["Atenda com comunicação respeitosa.","Pessoa","+10 Segurança"],
            ["Escolha uma resposta respeitosa.","Sala de reunião","+15 Segurança"]
          ]
        },
        {
          name:"EMPRESA DE TECNOLOGIA",
          palette:["#182d68","#6e4bb8","#f05252"],
          lesson:"Na manutenção, desligar, desconectar e seguir procedimentos é indispensável.",
          missions:[
            ["Organize os cabos.","Cabos","+10 Segurança"],
            ["Configure o equipamento.","Computador","+10 Segurança"],
            ["Converse com a equipe.","Equipe","+10 Segurança"],
            ["Decida a manutenção final.","Bancada final","+20 Segurança"]
          ]
        }
      ];

      function clearInputs() {
        Object.keys(keys).forEach((key) => delete keys[key]);
        Object.keys(touchKeys).forEach((key) => delete touchKeys[key]);
      }

      function closeAllModals() {
        ["instructions", "night-intro", "transition", "choice-modal", "pause-modal", "final-modal"].forEach((id) => {
          toggleModal(id, false);
        });
      }

      function resetHud() {
        setText("night-label", "NOITE 1/5");
        setText("place-label", "SUPERMERCADO");
        setText("security-label", "100");
        setText("objective-label", "Explore o ambiente.");

        const fill = byId("safe-fill");
        if (fill) {
          fill.style.width = "100%";
          fill.style.background = "#66d69a";
        }
      }

      function dialog(text, speaker = "Supervisor") {
        const dialogue = byId("dialogue");
        if (!dialogue) return;

        dialogue.innerHTML = "";
        const label = document.createElement("strong");
        label.textContent = speaker + ":";
        dialogue.appendChild(label);
        dialogue.appendChild(document.createTextNode(" " + text));
      }

      function feedback(text, good = true) {
        const element = byId("feedback");
        if (!element) return;

        element.textContent = text;
        element.style.color = good ? "#7dffac" : "#ff7b7b";
        element.style.opacity = "1";
        element.style.transform = "translate(-50%,-12px)";

        if (feedbackTimer) clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(() => {
          element.style.opacity = "0";
          element.style.transform = "translateX(-50%)";
        }, 1200);
      }

      function changeSafety(amount) {
        safety = Math.max(0, Math.min(100, safety + amount));
        totalScore += amount;

        setText("security-label", String(safety));

        const fill = byId("safe-fill");
        if (fill) {
          fill.style.width = safety + "%";
          fill.style.background = safety > 35 ? "#66d69a" : "#f05c5c";
        }

        feedback((amount > 0 ? "+" : "") + amount + " Segurança", amount > 0);

        if (safety === 0) {
          dialog("Alerta: sua Segurança chegou a zero. Continue, mas a ameaça ficou mais atenta.", "Sistema");
        }
      }

      function rect(x, y, width, height, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
      }

      function updateObjective() {
        const currentNight = nights[night];
        if (!currentNight) return;

        setText(
          "objective-label",
          missionIndex < 4 ? currentNight.missions[missionIndex][0] : "Turno concluído."
        );
      }

      function showNightIntro() {
        const currentNight = nights[night];
        const brief = nightBriefs[night];
        if (!currentNight || !brief) return;
        setText("night-intro-number", "NOITE " + (night + 1) + "/5");
        setText("night-intro-title", currentNight.name);
        setText("night-intro-description", brief[0]);
        const focus = byId("night-intro-focus");
        if (focus) {
          focus.innerHTML = "";
          brief[1].forEach((item) => {
            const li = document.createElement("li");
            li.textContent = item;
            focus.appendChild(li);
          });
        }
        state = "night-intro";
        toggleModal("night-intro", true);
      }

      function initNight() {
        const currentNight = nights[night];
        if (!currentNight) return;

        if (nightTimer) {
          clearTimeout(nightTimer);
          nightTimer = null;
        }

        clearInputs();

        state = "game";
        missionIndex = 0;
        chase = false;
        escapeHits = 0;

        player = {
          x:90,
          y:450,
          w:24,
          h:28,
          speed:165
        };

        const enemyStarts = [
          {x:820,y:90}, {x:560,y:120}, {x:820,y:390}, {x:820,y:90}, {x:700,y:390}
        ];
        enemy = {
          ...enemyStarts[night],
          w:25,
          h:32,
          speed:48 + night * 16,
          active:false
        };

        walls = [
          {x:0,y:0,w:960,h:24},
          {x:0,y:516,w:960,h:24},
          {x:0,y:0,w:24,h:540},
          {x:936,y:0,w:24,h:540},
          {x:310,y:105,w:220,h:25},
          {x:620,y:270,w:185,h:25}
        ];

        const labels = currentNight.missions.map((mission) => mission[1]);

        objects = labels.map((label, index) => ({
          x:150 + (index % 2) * 520,
          y:110 + Math.floor(index / 2) * 245,
          w:74,
          h:54,
          label,
          done:false
        }));

        setText("night-label", "NOITE " + (night + 1) + "/5");
        setText("place-label", currentNight.name);
        updateObjective();

        dialog(
          "Turno iniciado. " + (
            night === 0
              ? "E lembre-se: o fantasma do checklist observa tudo."
              : "Há algo no escuro que parece conhecer sua rotina..."
          )
        );
      }

      function collision(nextX, nextY) {
        if (!player) return true;

        const character = { x:nextX, y:nextY, w:player.w, h:player.h };

        const hitsWall = walls.some((wall) =>
          character.x < wall.x + wall.w &&
          character.x + character.w > wall.x &&
          character.y < wall.y + wall.h &&
          character.y + character.h > wall.y
        );

        const hitsObject = objects.some((object) =>
          !object.done &&
          character.x < object.x + object.w &&
          character.x + character.w > object.x &&
          character.y < object.y + object.h &&
          character.y + character.h > object.y
        );

        return hitsWall || hitsObject;
      }

      function near(object) {
        if (!player || !object) return false;

        return Math.hypot(
          player.x + 12 - (object.x + object.w / 2),
          player.y + 14 - (object.y + object.h / 2)
        ) < 72;
      }

      function showChoice(title, text, options) {
        const titleElement = byId("choice-title");
        const textElement = byId("choice-text");
        const box = byId("choice-options");

        if (!titleElement || !textElement || !box) return;

        state = "choice";
        titleElement.textContent = title;
        textElement.textContent = text;
        box.innerHTML = "";

        options.forEach(([label, callback]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "choice";
          button.textContent = label;

          button.addEventListener("click", () => {
            if (state !== "choice") return;
            toggleModal("choice-modal", false);
            state = "game";
            callback();
          }, { once:true });

          box.appendChild(button);
        });

        toggleModal("choice-modal", true);
      }

      function finishMission(points, text) {
        if (state !== "game" || !objects[missionIndex]) return;

        objects[missionIndex].done = true;
        changeSafety(points);
        dialog(text);

        missionIndex += 1;
        updateObjective();

        if (missionIndex === 2 && enemy && !enemy.active) {
          enemy.active = true;
          chase = true;
          dialog("Uma silhueta surge no corredor. Corra para longe dela e use ESPAÇO quando ela se aproximar!", "???");
        }

        if (missionIndex === 4) {
          if (nightTimer) clearTimeout(nightTimer);

          nightTimer = setTimeout(() => {
            if (state === "game") endNight();
          }, 850);
        }
      }

      function interact() {
        if (state !== "game" || !player) return;

        const target = objects.find((object) => !object.done && near(object));

        if (!target) {
          dialog("Nada para interagir aqui. Procure o objetivo destacado.", "Sistema");
          return;
        }

        if (objects[missionIndex] !== target) {
          dialog("Esta tarefa pode esperar. Siga o objetivo atual para manter o procedimento seguro.", "Supervisor");
          return;
        }

        if (night === 1 && missionIndex === 3) {
          showChoice(
            "EPI adequado",
            "Antes de movimentar a carga, qual item você escolhe?",
            [
              ["Luvas e calçado fechado", () => finishMission(15, "Boa escolha: proteção adequada e carga controlada.")],
              ["Nenhum, para ganhar tempo", () => {
                changeSafety(-10);
                finishMission(3, "Pressa não substitui proteção. Você corrigiu o procedimento a tempo.");
              }]
            ]
          );
          return;
        }

        if (night === 3 && missionIndex === 3) {
          showChoice(
            "Comunicação saudável",
            "Uma pessoa relata desconforto com uma fala inadequada. Como responder?",
            [
              ["Ouvir, acolher e orientar um canal respeitoso", () => finishMission(15, "Ambiente saudável começa com escuta e respeito.")],
              ["Ignorar para evitar conversa", () => {
                changeSafety(-10);
                finishMission(4, "Ignorar não resolve. Você decide encaminhar a situação com respeito.");
              }]
            ]
          );
          return;
        }

        if (night === 4 && missionIndex === 3) {
          showChoice(
            "Manutenção final",
            "O equipamento parece simples, mas há cabos e energia envolvidos. O que fazer?",
            [
              ["Desligar e desconectar antes de abrir", () => finishMission(20, "Procedimento correto: energia isolada antes da manutenção.")],
              ["Abrir rapidamente porque parece simples", () => {
                changeSafety(-25);
                finishMission(0, "O risco foi evitado por pouco. Você interrompe e refaz com segurança.");
              }],
              ["Pedir orientação e verificar o procedimento", () => finishMission(18, "Excelente: orientação e procedimento evitam improvisos.")]
            ]
          );
          return;
        }

        const mission = nights[night]?.missions[missionIndex];
        const points = mission ? parseInt(mission[2], 10) : 0;
        finishMission(points, "Tarefa concluída com segurança.");
      }

      function quickAction() {
        if (!player || !enemy) return;

        if (
          state === "game" &&
          chase &&
          Math.hypot(player.x - enemy.x, player.y - enemy.y) < 105
        ) {
          escapeHits += 1;
          feedback("FUGA +1", true);

          if (escapeHits >= 3) {
            chase = false;
            enemy.active = false;
            dialog("A silhueta recua. Um bilhete cai: “Não repita meus erros.”", "???");
          }
        }
      }

      function endNight() {
        if (!nights[night] || state !== "game") return;

        state = "transition";
        toggleModal("transition", true);

        setText("transition-title", "NOITE " + (night + 1) + " CONCLUÍDA");
        setText("transition-place", nights[night].name);
        setText("transition-message", nights[night].lesson);

        if (night === 4) {
          setText("transition-title", "A ÚLTIMA SOMBRA");
          setText("transition-place", "REVELAÇÃO");
          setText("transition-message", "A silhueta para. Ela tira o capuz: é você, alguns anos mais velho.");
        }
      }

      function finalGame() {
        state = "final";
        toggleModal("final-modal", true);

        setText(
          "final-story",
          safety >= 55
            ? "A versão futura revela que voltou para impedir o acidente causado por pequenas escolhas ignoradas. Você ouviu os sinais, pediu ajuda e construiu um futuro mais seguro."
            : "A versão futura revela que nasceu de uma rotina cheia de atalhos. Mesmo após tropeços, você percebeu que ainda pode mudar: segurança se aprende e se pratica todos os dias."
        );

        setText(
          "score-summary",
          "PONTUAÇÃO DE SEGURANÇA: " + Math.max(0, totalScore + 100) + " | ESTADO FINAL: " + safety + "/100"
        );
      }

      function advance() {
        if (state !== "transition") return;

        toggleModal("transition", false);

        if (night === 4) {
          finalGame();
          return;
        }

        night += 1;
        showNightIntro();
      }

      function restart() {
        if (nightTimer) {
          clearTimeout(nightTimer);
          nightTimer = null;
        }

        state = "menu";
        night = 0;
        safety = 100;
        totalScore = 0;
        missionIndex = 0;
        chase = false;
        escapeHits = 0;
        player = null;
        enemy = null;
        objects = [];
        walls = [];
        clearInputs();
        closeAllModals();
        resetHud();

        const gameShell = byId("game-shell");
        const menu = byId("menu");

        if (gameShell) gameShell.style.display = "none";
        if (menu) menu.style.display = "flex";

        dialog("Bem-vindo ao seu primeiro turno.");
      }

      function start() {
        if (state === "game" || state === "choice" || state === "transition") return;

        if (nightTimer) {
          clearTimeout(nightTimer);
          nightTimer = null;
        }

        closeAllModals();
        clearInputs();

        night = 0;
        safety = 100;
        totalScore = 0;

        const menu = byId("menu");
        const gameShell = byId("game-shell");

        if (menu) menu.style.display = "none";
        if (gameShell) gameShell.style.display = "block";

        setText("security-label", "100");

        const fill = byId("safe-fill");
        if (fill) {
          fill.style.width = "100%";
          fill.style.background = "#66d69a";
        }

        showNightIntro();
      }

      function beginShift() {
        if (state !== "night-intro") return;
        toggleModal("night-intro", false);
        initNight();
      }

      function pauseGame() {
        if (state !== "game") return;
        clearInputs();
        state = "pause";
        toggleModal("pause-modal", true);
      }

      function resumeGame() {
        if (state !== "pause") return;
        clearInputs();
        state = "game";
        toggleModal("pause-modal", false);
      }

      function move(delta) {
        if (state !== "game" || !player) return;

        let dx = 0;
        let dy = 0;

        if (keys.w || keys.arrowup) dy -= 1;
        if (keys.s || keys.arrowdown) dy += 1;
        if (keys.a || keys.arrowleft) dx -= 1;
        if (keys.d || keys.arrowright) dx += 1;
        dx += touchKeys.joystickX || 0;
        dy += touchKeys.joystickY || 0;

        if (dx || dy) {
          const length = Math.hypot(dx, dy);
          const scale = Math.min(1, length);
          dx = (dx / length) * scale * player.speed * delta;
          dy = (dy / length) * scale * player.speed * delta;

          if (!collision(player.x + dx, player.y)) player.x += dx;
          if (!collision(player.x, player.y + dy)) player.y += dy;
        }

        if (chase && enemy) {
          const enemyDx = player.x - enemy.x;
          const enemyDy = player.y - enemy.y;
          const distance = Math.hypot(enemyDx, enemyDy) || 1;

          enemy.x += (enemyDx / distance) * enemy.speed * delta;
          enemy.y += (enemyDy / distance) * enemy.speed * delta;

          if (distance < 35) {
            changeSafety(-10);
            enemy.x = 820;
            enemy.y = 80;
            dialog("Você escapou, mas perdeu Segurança. Não deixe a ameaça chegar tão perto!", "Sistema");
          }
        }
      }

      function draw() {
        const currentNight = nights[night];
        if (!currentNight || !player) return;

        const palette = currentNight.palette;

        rect(0, 0, W, H, palette[0]);

        for (let x = 0; x < W; x += 32) {
          for (let y = 0; y < H; y += 32) {
            ctx.strokeStyle = "#ffffff0c";
            ctx.strokeRect(x, y, 32, 32);
          }
        }

        walls.forEach((wall) => {
          rect(wall.x, wall.y, wall.w, wall.h, "#08111c");
          rect(wall.x + 3, wall.y + 3, wall.w - 6, wall.h - 6, palette[1]);
        });

        objects.forEach((object, index) => {
          rect(object.x, object.y, object.w, object.h, object.done ? "#315943" : palette[2]);

          ctx.fillStyle = object.done ? "#9ae6b4" : "#08111c";
          ctx.font = "bold 11px Space Mono";
          ctx.textAlign = "center";
          ctx.fillText(object.done ? "OK" : object.label, object.x + object.w / 2, object.y + 31);

          if (!object.done && index === missionIndex) {
            ctx.save();
            ctx.translate(object.x + object.w / 2, object.y + object.h / 2);
            ctx.strokeStyle = "#fff4a5";
            ctx.lineWidth = 3;
            ctx.strokeRect(-object.w / 2 - 4, -object.h / 2 - 4, object.w + 8, object.h + 8);
            ctx.fillStyle = "#fff4a5";
            ctx.font = "bold 12px Space Mono";
            ctx.fillText("! OBJETIVO", 0, -object.h / 2 - 10);
            ctx.restore();
          }
        });

        rect(player.x, player.y, player.w, player.h, "#ffd18a");
        rect(player.x + 4, player.y + 7, 16, 12, "#3c75a5");
        rect(player.x + 5, player.y - 4, 14, 8, "#592f25");

        if (enemy?.active) {
          ctx.globalAlpha = .82;
          rect(enemy.x, enemy.y, enemy.w, enemy.h, "#090610");
          rect(enemy.x + 6, enemy.y + 9, 4, 4, "#ff5c72");
          rect(enemy.x + 16, enemy.y + 9, 4, 4, "#ff5c72");
          ctx.globalAlpha = 1;
        }

        const gradient = ctx.createRadialGradient(
          player.x + 12,
          player.y + 14,
          20,
          player.x + 12,
          player.y + 14,
          270
        );

        gradient.addColorStop(0, "#ffffff10");
        gradient.addColorStop(1, "#00000092");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);

        if (chase) {
          ctx.strokeStyle = "#ff5c72";
          ctx.lineWidth = 5;
          ctx.strokeRect(4, 4, W - 8, H - 8);
        }
      }

      function animationLoop(timestamp) {
        const delta = Math.min(.035, ((timestamp - lastFrame) / 1000) || 0);
        lastFrame = timestamp;

        move(delta);

        if (nights[night]) draw();

        requestAnimationFrame(animationLoop);
      }

      function handleKeyDown(event) {
        const key = event.key.toLowerCase();
        const preventedKeys = ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "escape", "enter"];

        if (preventedKeys.includes(key)) event.preventDefault();

        if (event.repeat && ["enter", " ", "escape"].includes(key)) return;

        if (key === "escape") {
          if (state === "game") pauseGame();
          else if (state === "pause") resumeGame();
          return;
        }

        keys[key] = true;

        if (key === "enter") interact();
        if (key === " ") quickAction();
      }

      function handleKeyUp(event) {
        keys[event.key.toLowerCase()] = false;
      }

      function bindJoystick() {
        const base = byId("joystick");
        const knob = byId("joystick-knob");
        if (!base || !knob) return;

        let activePointerId = null;

        const reset = (event) => {
          if (event) event.preventDefault();
          touchKeys.joystickX = 0;
          touchKeys.joystickY = 0;
          knob.style.transform = "translate(0, 0)";
          if (activePointerId !== null && base.releasePointerCapture) {
            try {
              if (!base.hasPointerCapture || base.hasPointerCapture(activePointerId)) {
                base.releasePointerCapture(activePointerId);
              }
            } catch (error) {
              // O ponteiro pode já ter sido liberado pelo navegador.
            }
          }
          activePointerId = null;
        };

        const update = (event) => {
          if (activePointerId !== null && event.pointerId !== activePointerId) return;
          event.preventDefault();
          const rect = base.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const baseRadius = Math.min(rect.width, rect.height) / 2;
          const knobRadius = Math.min(knob.offsetWidth, knob.offsetHeight) / 2;
          const maxTravel = Math.max(0, baseRadius - knobRadius - 4);
          let x = event.clientX - centerX;
          let y = event.clientY - centerY;
          const distance = Math.hypot(x, y);
          if (distance > maxTravel && distance > 0) {
            x = (x / distance) * maxTravel;
            y = (y / distance) * maxTravel;
          }
          const travel = Math.hypot(x, y);
          const intensity = maxTravel ? travel / maxTravel : 0;
          if (intensity < 0.12 || !maxTravel) {
            touchKeys.joystickX = 0;
            touchKeys.joystickY = 0;
            knob.style.transform = "translate(0, 0)";
            return;
          }
          touchKeys.joystickX = (x / maxTravel);
          touchKeys.joystickY = (y / maxTravel);
          knob.style.transform = `translate(${x}px, ${y}px)`;
        };

        base.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          activePointerId = event.pointerId;
          if (base.setPointerCapture) {
            try { base.setPointerCapture(event.pointerId); } catch (error) {}
          }
          update(event);
        });
        base.addEventListener("pointermove", (event) => {
          if (activePointerId === event.pointerId) update(event);
        });
        ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => {
          base.addEventListener(type, (event) => {
            if (activePointerId === null || event.pointerId === activePointerId) reset(event);
          });
        });
      }

      function bindClick(id, callback) {
        const element = byId(id);
        if (!element) return;

        element.addEventListener("click", (event) => {
          event.preventDefault();
          callback();
        });
      }

      function initialize() {
        if (initialized) return;
        initialized = true;

        resetHud();

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);
        window.addEventListener("blur", clearInputs);

        bindClick("play-btn", start);
        bindClick("start-shift-btn", beginShift);
        bindClick("how-btn", () => toggleModal("instructions", true));
        bindClick("close-how", () => toggleModal("instructions", false));
        bindClick("continue-btn", advance);
        bindClick("resume-btn", resumeGame);
        bindClick("restart-pause-btn", restart);
        bindClick("restart-final-btn", restart);
        bindClick("touch-e", interact);
        bindClick("touch-space", quickAction);
        bindClick("advance-btn", interact);

        bindJoystick();

        requestAnimationFrame(animationLoop);
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once:true });
      } else {
        initialize();
      }
    })
    ();