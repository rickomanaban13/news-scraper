import React, { useState, ChangeEvent } from 'react';
import {
  Container,
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Box,
  InputAdornment,
  IconButton,
  Grid,
  AppBar,
  Toolbar,
  useTheme,
  alpha,
  Menu,
  MenuItem,
  Chip,
  Stack,
  Popover,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Tooltip,
  ButtonGroup,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import SortIcon from '@mui/icons-material/Sort';
import CloseIcon from '@mui/icons-material/Close';
import { parse, isValid, parseISO, format } from 'date-fns';

interface Article {
  headline: string;
  author: string;
  date: string;
  source: string;
  link: string;
}

type SortOption = 'date-desc' | 'date-asc' | 'relevance';

function App() {
  const [url, setUrl] = useState<string>('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterKeyword, setFilterKeyword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const theme = useTheme();

  const handleScrape = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('http://localhost:3001/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape the website');
      }

      setArticles(data.articles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleSortClick = (event: React.MouseEvent<HTMLElement>) => {
    setSortAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const handleSortClose = () => {
    setSortAnchorEl(null);
  };

  const handleAddFilter = (filter: string) => {
    if (!activeFilters.includes(filter)) {
      setActiveFilters([...activeFilters, filter]);
    }
    setFilterKeyword('');
    handleFilterClose();
  };

  const handleRemoveFilter = (filter: string) => {
    setActiveFilters(activeFilters.filter(f => f !== filter));
  };

  const sortArticles = (articles: Article[]) => {
    const parseDate = (dateStr: string): number => {
      if (!dateStr) return 0;

      try {
        // Try parsing common date formats
        const formats = [
          'MMMM d, yyyy',    // June 7, 2020
          'MMMM d yyyy',     // June 7 2020
          'MMM d, yyyy',     // Jun 7, 2020
          'yyyy-MM-dd',      // 2020-06-07
          'MM/dd/yyyy',      // 06/07/2020
          'HH:mm',           // 13:45 or 3:45
          "yyyy-MM-dd'T'HH:mm:ss.SSSX", // ISO format
        ];

        // Try each format until we find a valid date
        for (const formatStr of formats) {
          const parsedDate = parse(dateStr, formatStr, new Date());
          if (isValid(parsedDate)) {
            return parsedDate.getTime();
          }
        }

        // Try parsing as ISO date
        const isoDate = parseISO(dateStr);
        if (isValid(isoDate)) {
          return isoDate.getTime();
        }

        // Handle time-only format (e.g., "3:45" or "15:45")
        const timeMatch = dateStr.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const [_, hours, minutes] = timeMatch;
          const today = new Date();
          today.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          return today.getTime();
        }

        // Handle relative dates (e.g., "2 hours ago")
        const relativeMatch = dateStr.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/i);
        if (relativeMatch) {
          const [_, amount, unit] = relativeMatch;
          const now = new Date();
          const multipliers: Record<string, number> = {
            minute: 60 * 1000,
            hour: 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000,
            month: 30 * 24 * 60 * 60 * 1000,
            year: 365 * 24 * 60 * 60 * 1000
          };
          return now.getTime() - parseInt(amount) * (multipliers[unit.toLowerCase()] || 0);
        }

        // Last resort: try native Date parsing
        const fallbackDate = new Date(dateStr);
        return isValid(fallbackDate) ? fallbackDate.getTime() : 0;

      } catch {
        return 0; // Return 0 for unparseable dates
      }
    };

    return [...articles].sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      
      if (dateA === dateB) {
        // If dates are equal, sort by headline
        return a.headline.localeCompare(b.headline);
      }
      
      return sortBy === 'date-desc' ? dateB - dateA : dateA - dateB;
    });
  };

  const filteredArticles = sortArticles(
    articles.filter((article: Article) =>
      activeFilters.length === 0 || 
      activeFilters.some(filter => 
        article.headline.toLowerCase().includes(filter.toLowerCase()) ||
        article.author.toLowerCase().includes(filter.toLowerCase())
      )
    )
  );

  const predefinedFilters = ['Technology', 'Politics', 'Business', 'Sports', 'Entertainment', 'Science'];

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="fixed" sx={{ backgroundColor: theme.palette.background.paper }}>
        <Toolbar>
          <NewspaperIcon sx={{ mr: 2, color: theme.palette.primary.main }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 4, color: theme.palette.text.primary }}>
            News Scraper
          </Typography>
          
          <TextField
            size="small"
            placeholder="Enter website URL"
            variant="outlined"
            value={url}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
            sx={{
              mr: 2,
              backgroundColor: alpha(theme.palette.common.white, 0.15),
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: theme.palette.divider,
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.primary.main,
                },
              },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={handleScrape}
                    disabled={loading || !url}
                    size="small"
                  >
                    <SearchIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ButtonGroup variant="text" size="small">
              <Tooltip title="Filter articles by topic or keyword">
                <Button
                  onClick={handleFilterClick}
                  startIcon={<FilterListIcon />}
                  sx={{ 
                    color: theme.palette.text.primary,
                    textTransform: 'none',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    }
                  }}
                >
                  Filter
                </Button>
              </Tooltip>

              <Tooltip title="Sort articles by date or relevance">
                <Button
                  onClick={handleSortClick}
                  startIcon={<SortIcon />}
                  sx={{ 
                    color: theme.palette.text.primary,
                    textTransform: 'none',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    }
                  }}
                >
                  Sort: {sortBy === 'date-desc' ? 'Newest First' : 
                         sortBy === 'date-asc' ? 'Oldest First' : 
                         'By Relevance'}
                </Button>
              </Tooltip>
            </ButtonGroup>

            <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
              {activeFilters.map((filter) => (
                <Chip
                  key={filter}
                  label={filter}
                  onDelete={() => handleRemoveFilter(filter)}
                  size="small"
                  sx={{
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.2) },
                  }}
                />
              ))}
            </Stack>
          </Box>
        </Toolbar>
      </AppBar>

      <Popover
        open={Boolean(filterAnchorEl)}
        anchorEl={filterAnchorEl}
        onClose={handleFilterClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, width: 300 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Filter Articles
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Enter a keyword or select a category to filter articles
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Enter keyword..."
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && filterKeyword) {
                handleAddFilter(filterKeyword);
              }
            }}
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
            Popular Categories:
          </Typography>
          <Grid container spacing={1}>
            {predefinedFilters.map((filter) => (
              <Grid item key={filter}>
                <Chip
                  label={filter}
                  onClick={() => handleAddFilter(filter)}
                  size="small"
                  sx={{
                    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) },
                  }}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Popover>

      <Menu
        anchorEl={sortAnchorEl}
        open={Boolean(sortAnchorEl)}
        onClose={handleSortClose}
      >
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle2" sx={{ px: 2, pb: 1 }}>
            Sort Articles
          </Typography>
          <FormControl>
            <RadioGroup
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortOption);
                handleSortClose();
              }}
            >
              <MenuItem>
                <FormControlLabel
                  value="date-desc"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body1">Newest First</Typography>
                      <Typography variant="body2" color="textSecondary">
                        Show most recent articles first
                      </Typography>
                    </Box>
                  }
                />
              </MenuItem>
              <MenuItem>
                <FormControlLabel
                  value="date-asc"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body1">Oldest First</Typography>
                      <Typography variant="body2" color="textSecondary">
                        Show oldest articles first
                      </Typography>
                    </Box>
                  }
                />
              </MenuItem>
              <MenuItem>
                <FormControlLabel
                  value="relevance"
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body1">By Relevance</Typography>
                      <Typography variant="body2" color="textSecondary">
                        Sort by filter match relevance
                      </Typography>
                    </Box>
                  }
                />
              </MenuItem>
            </RadioGroup>
          </FormControl>
        </Box>
      </Menu>

      <Container maxWidth="lg" sx={{ pt: 10, pb: 4 }}>
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Typography color="error" textAlign="center" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        {!loading && articles.length > 0 && (
          <Grid container spacing={3}>
            {filteredArticles.map((article: Article, index: number) => (
              <Grid item xs={12} key={index}>
                <Card elevation={2} sx={{ 
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  }
                }}>
                  <CardContent>
                    <Typography variant="h6" component="h2" gutterBottom>
                      {article.headline}
                    </Typography>
                    <Typography color="textSecondary" gutterBottom>
                      By {article.author} • {article.date}
                    </Typography>
                    <Typography color="textSecondary" gutterBottom>
                      Source: {article.source}
                    </Typography>
                    <Button
                      variant="contained"
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        mt: 1,
                        textTransform: 'none',
                        borderRadius: '20px',
                      }}
                    >
                      Read More
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {!loading && articles.length === 0 && (
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            justifyContent="center" 
            minHeight="50vh"
          >
            <NewspaperIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography textAlign="center" color="textSecondary">
              No articles found. Enter a URL and click the search icon to start scraping.
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}

export default App;