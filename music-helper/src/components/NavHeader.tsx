import { Link as RouterLink } from '@tanstack/react-router'
import { AppBar, Button, Container, Toolbar, Box, Typography } from '@mui/material'
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic'

const pages = [
    { label: 'Scales', to: '/scales' },
    { label: 'Chords', to: '/chords' },
]

function NavHeader() {
    return (
        <AppBar position="static">
            <Container maxWidth="xl">
                <Toolbar disableGutters>
                    <LibraryMusicIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }}/>
                    <Typography
                        variant="h6"
                        sx={{
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        <Typography
                            variant="h6"
                            noWrap
                            component="a"
                            sx={{
                                mr: 2,
                                fontWeight: 700,
                            }}
                        >
                            Music Helper
                        </Typography>
                    </Typography>

                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0,
                        }}
                    >
                        {pages.map((page) => (
                            <Button
                                key={page.to}
                                component={RouterLink}
                                to={page.to}
                                activeOptions={{ exact: true }}
                                sx={{
                                    color: 'white',
                                    '&[data-status="active"]': {
                                        color: 'secondary.main',
                                    },
                                }}
                            >
                                {page.label}
                            </Button>
                        ))}
                    </Box>
                </Toolbar>
            </Container>
        </AppBar>
    )
}

export default NavHeader