import axios from 'axios';

export const playMove = async (gameId: string, position: number) => {
    // TODO: Call de DB to get the current GameState
    
    // Prepare data for the Rust module proccessing
    const engineUrl = process.env.RUST_ENGINE_URL || 'http://localhost:4000';

    // The "Intercom" call to Rust
    const response = await axios.post(`${engineUrl}/verify`, {
    position: position,
    // TODO:Pass current YEN layout here
    });

    // TODO: Update the DB with the new layout returned by Rust
    return response.data;
}