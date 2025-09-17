const ChessGame = {
    board: [],
    currentPlayer: 'white',
    selectedSquare: null,
    gameOver: false,
    isAI: true,
    difficulty: 2,
    capturedPieces: { white: [], black: [] },
    moveHistory: [],
    kingPositions: { white: [7, 4], black: [0, 4] },

    pieces: {
        'white': { 'king': '♔', 'queen': '♕', 'rook': '♖', 'bishop': '♗', 'knight': '♘', 'pawn': '♙' },
        'black': { 'king': '♚', 'queen': '♛', 'rook': '♜', 'bishop': '♝', 'knight': '♞', 'pawn': '♟' }
    },

    pieceValues: { 'pawn': 1, 'knight': 3, 'bishop': 3, 'rook': 5, 'queen': 9, 'king': 100 },
    
    init() {
        this.setupBoard();
        this.renderBoard();
        this.updateDisplay();
        this.addEventListeners();
    },
    
    addEventListeners() {
        document.getElementById('newGameBtn').addEventListener('click', () => this.startNewGame());
        document.getElementById('toggleAIBtn').addEventListener('click', () => this.toggleGameMode());
        document.getElementById('undoBtn').addEventListener('click', () => this.undoMove());
        document.getElementById('difficultySelect').addEventListener('change', (e) => this.setDifficulty(e.target.value));
    },

    setupBoard() {
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        const setup = (color, pawnRow, pieceRow) => {
            for (let i = 0; i < 8; i++) this.board[pawnRow][i] = { type: 'pawn', color: color, hasMoved: false };
            const pieces = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
            for (let i = 0; i < 8; i++) this.board[pieceRow][i] = { type: pieces[i], color: color, hasMoved: false };
        };
        setup('black', 1, 0);
        setup('white', 6, 7);
        this.kingPositions = { white: [7, 4], black: [0, 4] };
    },
    
    renderBoard() {
        const boardElement = document.querySelector('.chess-board');
        boardElement.innerHTML = '';
        
        const kingInCheckPos = this.isKingInCheck(this.currentPlayer) ? this.kingPositions[this.currentPlayer] : null;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `chess-square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                
                if (kingInCheckPos && row === kingInCheckPos[0] && col === kingInCheckPos[1]) {
                    square.classList.add('king-in-check');
                }

                const piece = this.board[row][col];
                if (piece) square.textContent = this.pieces[piece.color][piece.type];
                
                square.addEventListener('click', () => this.handleSquareClick(row, col));
                boardElement.appendChild(square);
            }
        }
    },
    
    handleSquareClick(row, col) {
        if (this.gameOver || (this.isAI && this.currentPlayer === 'black')) return;
        
        if (this.selectedSquare) {
            if (this.isValidMove(this.selectedSquare, {row, col})) {
                this.makeMove(this.selectedSquare, {row, col});
                this.clearSelection();
                if (!this.gameOver && this.isAI && this.currentPlayer === 'black') {
                    setTimeout(() => this.makeAIMove(), 500);
                }
            } else {
                this.clearSelection();
                const piece = this.board[row][col];
                if (piece && piece.color === this.currentPlayer) this.selectSquare(row, col);
            }
        } else {
            const piece = this.board[row][col];
            if (piece && piece.color === this.currentPlayer) this.selectSquare(row, col);
        }
    },

    selectSquare(row, col) {
        this.clearSelection();
        this.selectedSquare = { row, col };
        document.querySelector(`[data-row="${row}"][data-col="${col}"]`).classList.add('selected');
        
        const validMoves = this.getValidMovesForPiece(row, col);
        validMoves.forEach(move => {
            document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`).classList.add('valid-move');
        });
    },

    clearSelection() {
        this.selectedSquare = null;
        document.querySelectorAll('.chess-square').forEach(s => s.classList.remove('selected', 'valid-move'));
    },

    isValidMove(from, to, checkKingSafety = true) {
        const piece = this.board[from.row][from.col];
        if (!piece) return false;
        const targetPiece = this.board[to.row][to.col];
        if (targetPiece && targetPiece.color === piece.color) return false;
        
        if (checkKingSafety) {
            const tempBoard = JSON.parse(JSON.stringify(this.board));
            const tempKingPos = JSON.parse(JSON.stringify(this.kingPositions));
            this.simulateMove(from, to, tempBoard, tempKingPos);
            if (this.isKingInCheck(piece.color, tempBoard, tempKingPos)) return false;
        }
        
        return this.getPieceSpecificMoves(from).some(move => move.row === to.row && move.col === to.col);
    },

    getPieceSpecificMoves(from) {
        const piece = this.board[from.row][from.col];
        const moves = [];
        const addMove = (row, col) => moves.push({row, col});
        const addLine = (dr, dc) => {
            for (let i = 1; i < 8; i++) {
                const r = from.row + i * dr, c = from.col + i * dc;
                if (r < 0 || r > 7 || c < 0 || c > 7) break;
                const target = this.board[r][c];
                if (target) { if (target.color !== piece.color) addMove(r, c); break; }
                addMove(r, c);
            }
        };

        switch (piece.type) {
            case 'pawn':
                const dir = piece.color === 'white' ? -1 : 1;
                const startRow = piece.color === 'white' ? 6 : 1;
                if (!this.board[from.row + dir]?.[from.col]) addMove(from.row + dir, from.col);
                if (from.row === startRow && !this.board[from.row + dir]?.[from.col] && !this.board[from.row + 2 * dir]?.[from.col]) addMove(from.row + 2 * dir, from.col);
                [-1, 1].forEach(dc => {
                    const target = this.board[from.row + dir]?.[from.col + dc];
                    if (target && target.color !== piece.color) addMove(from.row + dir, from.col + dc);
                    const lastMove = this.moveHistory[this.moveHistory.length - 1];
                    if (lastMove && lastMove.piece.type === 'pawn' && Math.abs(lastMove.to.row - lastMove.from.row) === 2 &&
                        from.row === lastMove.to.row && from.col + dc === lastMove.to.col && from.row + dir === (lastMove.from.row + lastMove.to.row) / 2) {
                        addMove(from.row + dir, from.col + dc);
                    }
                });
                break;
            case 'rook': [ [0,1], [0,-1], [1,0], [-1,0] ].forEach(([dr, dc]) => addLine(dr, dc)); break;
            case 'bishop': [ [1,1], [1,-1], [-1,1], [-1,-1] ].forEach(([dr, dc]) => addLine(dr, dc)); break;
            case 'queen': [ [0,1], [0,-1], [1,0], [-1,0], [1,1], [1,-1], [-1,1], [-1,-1] ].forEach(([dr, dc]) => addLine(dr, dc)); break;
            case 'knight': [ [1,2], [1,-2], [-1,2], [-1,-2], [2,1], [2,-1], [-2,1], [-2,-1] ].forEach(([dr, dc]) => {
                const r = from.row + dr, c = from.col + dc;
                if (r >= 0 && r < 8 && c >= 0 && c < 8) addMove(r, c);
            }); break;
            case 'king':
                [ [0,1], [0,-1], [1,0], [-1,0], [1,1], [1,-1], [-1,1], [-1,-1] ].forEach(([dr, dc]) => {
                    const r = from.row + dr, c = from.col + dc;
                    if (r >= 0 && r < 8 && c >= 0 && c < 8) addMove(r, c);
                });
                if (!piece.hasMoved && !this.isKingInCheck(piece.color)) {
                    if (!this.board[from.row][5] && !this.board[from.row][6] && this.board[from.row][7]?.type === 'rook' && !this.board[from.row][7].hasMoved) {
                        if (!this.isSquareAttacked(from.row, 5, piece.color) && !this.isSquareAttacked(from.row, 6, piece.color)) addMove(from.row, 6);
                    }
                    if (!this.board[from.row][3] && !this.board[from.row][2] && !this.board[from.row][1] && this.board[from.row][0]?.type === 'rook' && !this.board[from.row][0].hasMoved) {
                        if (!this.isSquareAttacked(from.row, 3, piece.color) && !this.isSquareAttacked(from.row, 2, piece.color)) addMove(from.row, 2);
                    }
                }
                break;
        }
        return moves;
    },

    getValidMovesForPiece(row, col) {
        return this.getPieceSpecificMoves({row, col})
            .filter(move => this.isValidMove({row, col}, move));
    },

    getAllValidMoves(color) {
        const allMoves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === color) {
                    this.getValidMovesForPiece(r, c).forEach(move => {
                        allMoves.push({ from: {row: r, col: c}, to: move });
                    });
                }
            }
        }
        return allMoves;
    },

    simulateMove(from, to, board, kingPositions) {
        const piece = board[from.row][from.col];
        if (piece.type === 'king') kingPositions[piece.color] = [to.row, to.col];
        board[to.row][to.col] = piece;
        board[from.row][from.col] = null;
    },

    isKingInCheck(color, board = this.board, kingPositions = this.kingPositions) {
        const kingPos = kingPositions[color];
        if (!kingPos) return false;
        return this.isSquareAttacked(kingPos[0], kingPos[1], color, board);
    },
    
    isSquareAttacked(row, col, byColor, board = this.board) {
        const opponentColor = byColor === 'white' ? 'black' : 'white';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (piece && piece.color === opponentColor) {
                    if (this.getPieceSpecificMoves({row: r, col: c}).some(m => m.row === row && m.col === col)) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    makeMove(from, to) {
        const piece = this.board[from.row][from.col];
        const captured = this.board[to.row][to.col];
        const moveData = { from, to, piece, captured, enPassant: false, castling: false };

        if (piece.type === 'king' && Math.abs(to.col - from.col) === 2) {
            const rookCol = to.col === 6 ? 7 : 0;
            const rookTargetCol = to.col === 6 ? 5 : 3;
            const rook = this.board[from.row][rookCol];
            this.board[from.row][rookTargetCol] = rook;
            this.board[from.row][rookCol] = null;
            rook.hasMoved = true;
            moveData.castling = true;
        }
        
        if (piece.type === 'pawn' && Math.abs(from.col - to.col) === 1 && !captured) {
             const capturedPawnPos = { row: from.row, col: to.col };
             moveData.captured = this.board[capturedPawnPos.row][capturedPawnPos.col];
             this.board[capturedPawnPos.row][capturedPawnPos.col] = null;
             moveData.enPassant = true;
        }

        if (captured) this.capturedPieces[captured.color].push(captured);
        this.board[to.row][to.col] = piece;
        this.board[from.row][from.col] = null;
        piece.hasMoved = true;
        if (piece.type === 'king') this.kingPositions[piece.color] = [to.row, to.col];
        
        if (piece.type === 'pawn' && (to.row === 0 || to.row === 7)) {
            this.board[to.row][to.col] = { type: 'queen', color: piece.color, hasMoved: true };
        }

        this.moveHistory.push(moveData);
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.renderBoard();
        this.updateDisplay();
        this.checkGameEnd();
    },

    makeAIMove() {
        const bestMove = this.minimaxRoot(this.difficulty, true);
        if (bestMove) this.makeMove(bestMove.from, bestMove.to);
    },

    minimaxRoot(depth, isMaximizingPlayer) {
        const moves = this.getAllValidMoves(this.currentPlayer);
        let bestMoveValue = isMaximizingPlayer ? -Infinity : Infinity;
        let bestMoveFound = null;

        for (const move of moves) {
            const tempBoard = JSON.parse(JSON.stringify(this.board));
            const tempKingPos = JSON.parse(JSON.stringify(this.kingPositions));
            this.simulateMove(move.from, move.to, tempBoard, tempKingPos);
            
            const value = this.minimax(depth - 1, tempBoard, tempKingPos, !isMaximizingPlayer, -Infinity, Infinity);
            
            if (isMaximizingPlayer) {
                if (value > bestMoveValue) {
                    bestMoveValue = value;
                    bestMoveFound = move;
                }
            } else {
                if (value < bestMoveValue) {
                    bestMoveValue = value;
                    bestMoveFound = move;
                }
            }
        }
        return bestMoveFound || moves[Math.floor(Math.random() * moves.length)];
    },
    
    minimax(depth, board, kingPositions, isMaximizingPlayer, alpha, beta) {
        if (depth === 0) return this.evaluateBoard(board);

        const color = isMaximizingPlayer ? 'black' : 'white';
        const moves = this.getAllValidMovesOnBoard(color, board, kingPositions);
        let bestValue = isMaximizingPlayer ? -Infinity : Infinity;

        for (const move of moves) {
            const newBoard = JSON.parse(JSON.stringify(board));
            const newKingPos = JSON.parse(JSON.stringify(kingPositions));
            this.simulateMove(move.from, move.to, newBoard, newKingPos);
            
            const value = this.minimax(depth - 1, newBoard, newKingPos, !isMaximizingPlayer, alpha, beta);
            
            if (isMaximizingPlayer) {
                bestValue = Math.max(bestValue, value);
                alpha = Math.max(alpha, bestValue);
            } else {
                bestValue = Math.min(bestValue, value);
                beta = Math.min(beta, bestValue);
            }
            if (beta <= alpha) break;
        }
        return bestValue;
    },

    evaluateBoard(board) {
        let total = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (piece) {
                    const value = this.pieceValues[piece.type];
                    total += piece.color === 'black' ? value : -value;
                }
            }
        }
        return total;
    },
    
    getAllValidMovesOnBoard(color, board, kingPositions) {
         const allMoves = [];
         const originalBoard = JSON.parse(JSON.stringify(this.board));
         this.board = board;

         for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] && this.board[r][c].color === color) {
                    this.getValidMovesForPiece(r, c).forEach(move => {
                        allMoves.push({ from: {row: r, col: c}, to: move });
                    });
                }
            }
         }
         this.board = originalBoard;
         return allMoves;
    },
    
    checkGameEnd() {
        const moves = this.getAllValidMoves(this.currentPlayer);
        if (moves.length === 0) {
            this.gameOver = true;
            const status = this.isKingInCheck(this.currentPlayer) ? 
                `Checkmate! ${this.currentPlayer === 'white' ? 'Black' : 'White'} wins!` : 'Stalemate! It\'s a draw.';
            document.getElementById('gameStatus').textContent = status;
        }
    },
    
    updateDisplay() {
        document.getElementById('currentPlayerDisplay').textContent = 
            this.gameOver ? 'Game Over' : `${this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1)}'s Turn`;
        
        if (!this.gameOver) document.getElementById('gameStatus').textContent = 'Game in progress';
        
        document.getElementById('aiStatus').textContent = 
            `AI: ${this.isAI ? ['Easy', 'Medium', 'Hard'][this.difficulty - 1] : 'Off'}`;
        
        this.updateCapturedPieces();
        this.updateMovesList();
    },

    updateCapturedPieces() {
        const createHtml = (pieces) => pieces.map(p => `<span>${this.pieces[p.color][p.type]}</span>`).join('');
        document.getElementById('capturedWhite').innerHTML = createHtml(this.capturedPieces.white);
        document.getElementById('capturedBlack').innerHTML = createHtml(this.capturedPieces.black);
    },
    
    updateMovesList() {
        const movesDisplay = document.getElementById('movesDisplay');
        const notation = (move) => `${this.getPieceNotation(move.piece.type)}${String.fromCharCode(97 + move.from.col)}${8 - move.from.row}${move.captured ? 'x' : ''}${String.fromCharCode(97 + move.to.col)}${8 - move.to.row}`;
        movesDisplay.innerHTML = this.moveHistory.map((move, i) =>
            i % 2 === 0 ? `<br>${Math.floor(i / 2) + 1}. ${notation(move)}` : notation(move)
        ).join(' ');
        movesDisplay.scrollTop = movesDisplay.scrollHeight;
    },

    getPieceNotation(type) {
        return { 'pawn': '', 'knight': 'N', 'bishop': 'B', 'rook': 'R', 'queen': 'Q', 'king': 'K' }[type];
    },

    startNewGame() {
        this.currentPlayer = 'white';
        this.gameOver = false;
        this.capturedPieces = { white: [], black: [] };
        this.moveHistory = [];
        this.selectedSquare = null;
        this.init();
    },

    toggleGameMode() {
        this.isAI = !this.isAI;
        this.updateDisplay();
    },

    setDifficulty(value) {
        this.difficulty = parseInt(value, 10);
        this.updateDisplay();
    },
    
    undoMove() {
        if (this.moveHistory.length === 0) return;
        
        const movesToUndo = this.isAI && this.currentPlayer === 'white' && this.moveHistory.length >= 2 ? 2 : 1;
        
        for(let i=0; i < movesToUndo; i++){
            if(this.moveHistory.length === 0) break;

            const lastMove = this.moveHistory.pop();
            const piece = lastMove.piece;
            this.board[lastMove.from.row][lastMove.from.col] = piece;
            
            let restoredPiece = lastMove.captured;
            if(lastMove.enPassant){
                 this.board[lastMove.to.row][lastMove.to.col] = null;
                 this.board[lastMove.from.row][lastMove.to.col] = restoredPiece;
            } else {
                 this.board[lastMove.to.row][lastMove.to.col] = restoredPiece;
            }
            
            if (restoredPiece) {
                const arr = this.capturedPieces[restoredPiece.color];
                const index = arr.findIndex(p => p.type === restoredPiece.type && p.color === restoredPiece.color);
                if(index > -1) arr.splice(index, 1);
            }

            if(lastMove.castling){
                const rookCol = lastMove.to.col === 6 ? 7 : 0;
                const rookTargetCol = lastMove.to.col === 6 ? 5 : 3;
                this.board[lastMove.from.row][rookCol] = this.board[lastMove.from.row][rookTargetCol];
                this.board[lastMove.from.row][rookTargetCol] = null;
            }
            
            if (piece.type === 'king') this.kingPositions[piece.color] = [lastMove.from.row, lastMove.from.col];
            this.currentPlayer = piece.color;
        }
        
        this.gameOver = false;
        this.renderBoard();
        this.updateDisplay();
    },
};

document.addEventListener('DOMContentLoaded', () => ChessGame.init());
